#!/usr/bin/env python3
import os
import sys
import json
import time
import argparse
import xml.etree.ElementTree as ET
from math import cos, sin, radians, atan2, degrees
import threading
import queue
import numpy as np
import traceback

# Try to add SUMO tools to path for traci
if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    if tools not in sys.path:
        sys.path.append(tools)

try:
    import traci
    from sumolib import checkBinary
    from sumolib.net import readNet
except Exception as e:
    print(json.dumps({"type": "error", "message": f"Failed to import traci/sumolib: {e}"}))
    sys.stdout.flush()
    sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sumo-bin', required=False, default='sumo')
    parser.add_argument('--sumo-cfg', required=True)
    parser.add_argument('--step-length', required=False, default='1.0')
    # Optional RL control
    parser.add_argument('--rl-model', required=False, default=None, help='Path to SB3 PPO model (.zip) for targeted env')
    parser.add_argument('--rl-delta', required=False, type=int, default=15, help='Decision interval (seconds) for RL env')
    parser.add_argument('--rl-use-gui', action='store_true', help='Use SUMO GUI for RL env')
    return parser.parse_args()


def resolve_net_path_from_cfg(cfg_path):
    try:
        tree = ET.parse(cfg_path)
        root = tree.getroot()
        net_file = None
        for inp in root.findall('input'):
            net_el = inp.find('net-file')
            if net_el is not None:
                net_file = net_el.get('value')
                break
        if net_file is None:
            # also support direct child
            net_el = root.find('./input/net-file')
            if net_el is not None:
                net_file = net_el.get('value')
        if net_file is None:
            return None
        # resolve relative to cfg dir
        cfg_dir = os.path.dirname(os.path.abspath(cfg_path))
        net_path = os.path.abspath(os.path.join(cfg_dir, net_file))
        return net_path
    except Exception:
        return None


def build_tls_mapping(net_path):
    """
    Create a mapping from junction IDs (used by traci) to tlLogic IDs (user-friendly names).
    Also create reverse mapping from tlLogic IDs to junction IDs.
    """
    try:
        tree = ET.parse(net_path)
        root = tree.getroot()
        
        # Map tlLogic ID -> junction ID and junction ID -> tlLogic ID
        tllogic_to_junction = {}
        junction_to_tllogic = {}
        
        # Find all connections with tl attribute to map tlLogic IDs to junction IDs
        for connection in root.findall('connection'):
            tl_attr = connection.get('tl')
            via_attr = connection.get('via')
            if tl_attr and via_attr:
                # Extract junction ID from via (e.g. ":cluster_283262872_444451567_0_0" -> "cluster_283262872_444451567")
                if via_attr.startswith(':'):
                    junction_parts = via_attr[1:].split('_')
                    # Reconstruct junction ID by removing the last connection-specific parts
                    if len(junction_parts) >= 3:
                        # For cluster junctions like "cluster_283262872_444451567_0_0"
                        # We want "cluster_283262872_444451567"
                        junction_id = '_'.join(junction_parts[:-2])
                        tllogic_to_junction[tl_attr] = junction_id
                        junction_to_tllogic[junction_id] = tl_attr
        
        print(json.dumps({"type": "log", "level": "info", "message": f"Built TLS mapping: {len(tllogic_to_junction)} traffic lights mapped"}))
        sys.stdout.flush()
        
        return tllogic_to_junction, junction_to_tllogic
    except Exception as e:
        print(json.dumps({"type": "log", "level": "error", "message": f"Failed to build TLS mapping: {e}"}))
        sys.stdout.flush()
        return {}, {}


def build_network_payload(net_path):
    try:
        net = readNet(net_path)
        xmin, ymin, xmax, ymax = net.getBoundary()
        lanes = []
        for edge in net.getEdges():
            for lane in edge.getLanes():
                shape = lane.getShape()
                lanes.append({
                    'id': lane.getID(),
                    'speed': lane.getSpeed(),
                    'length': lane.getLength(),
                    'points': [{'x': float(p[0]), 'y': float(p[1])} for p in shape]
                })
        payload = {
            'type': 'net',
            'bounds': {'minX': float(xmin), 'minY': float(ymin), 'maxX': float(xmax), 'maxY': float(ymax)},
            'lanes': lanes
        }
        return payload
    except Exception as e:
        return { 'type': 'error', 'message': f'Failed to load net: {e}' }


def main():
    args = parse_args()
    
    # Build TLS ID mapping from network file
    net_path = resolve_net_path_from_cfg(args.sumo_cfg)
    tllogic_to_junction = {}
    junction_to_tllogic = {}
    if net_path:
        tllogic_to_junction, junction_to_tllogic = build_tls_mapping(net_path)

    # Set up stdin command queue (non-blocking via thread)
    cmd_queue = queue.Queue()

    def stdin_reader(q: queue.Queue):
        try:
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue
                try:
                    cmd = json.loads(line)
                    q.put(cmd)
                except Exception:
                    print(json.dumps({"type": "log", "level": "warn", "message": f"Malformed command: {line}"}))
                    sys.stdout.flush()
        except Exception:
            # stdin closed or not readable
            pass

    reader_thread = threading.Thread(target=stdin_reader, args=(cmd_queue,), daemon=True)
    reader_thread.start()

    def handle_command(cmd: dict, tllogic_to_junction_map: dict = None):
        nonlocal tllogic_to_junction  # Access the mapping from outer scope
        if tllogic_to_junction_map:
            tllogic_to_junction = tllogic_to_junction_map
        try:
            # Helper to emit an immediate small viz payload for a single TLS
            def emit_tls_update(junction_id):
                try:
                    display_id = junction_to_tllogic.get(junction_id, junction_id)
                    state = traci.trafficlight.getRedYellowGreenState(junction_id)
                    tls_obj = { 'id': display_id, 'state': state }
                    try:
                        sim_t = float(traci.simulation.getTime())
                        cur_idx = int(traci.trafficlight.getPhase(junction_id))
                        num_phases = int(traci.trafficlight.getPhaseNumber(junction_id))
                        next_sw = float(traci.trafficlight.getNextSwitch(junction_id))
                        remaining = max(0.0, next_sw - sim_t)
                        nxt_idx = (cur_idx + 1) % max(1, num_phases)
                        tls_obj['timing'] = {
                            'currentIndex': cur_idx,
                            'numPhases': num_phases,
                            'remaining': remaining,
                            'nextIndex': nxt_idx,
                            'nextSwitch': next_sw,
                            'simTime': sim_t
                        }
                    except Exception:
                        pass
                    # Print a minimal viz payload so the server will forward it
                    payload = {
                        'type': 'viz',
                        'step': -1,
                        'ts': int(time.time() * 1000),
                        'vehicles': [],
                        'tls': [tls_obj]
                    }
                    print(json.dumps(payload))
                    sys.stdout.flush()
                except Exception:
                    # best-effort only
                    pass

            print(json.dumps({"type": "log", "level": "info", "message": f"🚦 RECEIVED TLS COMMAND: {cmd}"}))
            sys.stdout.flush()
            
            if not isinstance(cmd, dict):
                print(json.dumps({"type": "log", "level": "warn", "message": f"Command is not dict: {type(cmd)}"}))
                sys.stdout.flush()
                return
                
            cmd_type = cmd.get('type')
            if cmd_type not in ['tls', 'tls_state']:
                print(json.dumps({"type": "log", "level": "debug", "message": f"Command type is not supported: {cmd_type}"}))
                sys.stdout.flush()
                return
                
            tls_id_input = cmd.get('id')
            if not tls_id_input:
                print(json.dumps({"type": "log", "level": "warn", "message": "No TLS ID provided"}))
                sys.stdout.flush()
                return
                
            action = cmd.get('cmd')
            print(json.dumps({"type": "log", "level": "info", "message": f"Processing TLS command - Input ID: {tls_id_input}, Action: {action}"}))
            sys.stdout.flush()
            
            # Use the TLS ID directly (mapping is now handled by backend)
            tls_id = tls_id_input
            print(json.dumps({"type": "log", "level": "info", "message": f"Using TLS ID: '{tls_id}' (backend handles friendly name mapping)"}))
            sys.stdout.flush()
            
            # Check if TLS exists - IMMEDIATE EXECUTION
            try:
                all_tls = traci.trafficlight.getIDList()
                print(json.dumps({"type": "log", "level": "info", "message": f"🔍 CHECKING TLS: {tls_id} in {len(all_tls)} available TLS"}))
                sys.stdout.flush()
                
                if tls_id not in all_tls:
                    print(json.dumps({"type": "log", "level": "error", "message": f"❌ TLS '{tls_id}' NOT FOUND! Available: {list(all_tls)[:5]}..."}))
                    sys.stdout.flush()
                    return
                    
                current_phase = traci.trafficlight.getPhase(tls_id)
                current_state = traci.trafficlight.getRedYellowGreenState(tls_id)
                print(json.dumps({"type": "log", "level": "info", "message": f"✅ TLS '{tls_id}' FOUND! Current phase: {current_phase}, state: {current_state}"}))
                sys.stdout.flush()
            except Exception as e:
                print(json.dumps({"type": "log", "level": "error", "message": f"💥 FAILED TO CHECK TLS: {e}"}))
                sys.stdout.flush()
                return
            
            # Handle direct state setting - FORCE IMMEDIATE EXECUTION
            if cmd_type == 'tls_state':
                try:
                    desired_phase = cmd.get('phase')
                    if not desired_phase:
                        print(json.dumps({"type": "log", "level": "error", "message": "❌ NO PHASE STATE PROVIDED!"}))
                        sys.stdout.flush()
                        return
                    
                    current_state = traci.trafficlight.getRedYellowGreenState(tls_id)
                    print(json.dumps({"type": "log", "level": "info", "message": f"🎯 SETTING TLS {tls_id}: '{current_state}' → '{desired_phase}'"}))
                    sys.stdout.flush()
                    
                    # FORCE STATE CHANGE
                    traci.trafficlight.setRedYellowGreenState(tls_id, desired_phase)
                    print(json.dumps({"type": "log", "level": "info", "message": f"🔄 STATE SET COMMAND EXECUTED!"}))
                    sys.stdout.flush()
                    
                    # FORCE SIMULATION STEP
                    traci.simulationStep()
                    print(json.dumps({"type": "log", "level": "info", "message": f"⏩ SIMULATION STEP FORCED!"}))
                    sys.stdout.flush()
                    
                    # VERIFY CHANGE
                    new_state = traci.trafficlight.getRedYellowGreenState(tls_id)
                    print(json.dumps({"type": "log", "level": "info", "message": f"✅ TLS {tls_id} STATE CHANGED: '{new_state}'"}))
                    sys.stdout.flush()
                    # Emit an immediate TLS update so clients see the change without waiting for next loop
                    try:
                        emit_tls_update(tls_id)
                    except Exception:
                        pass
                    return
                except Exception as e:
                    print(json.dumps({"type": "log", "level": "error", "message": f"💥 TLS STATE SETTING FAILED: {e}"}))
                    print(json.dumps({"type": "log", "level": "error", "message": f"Stack: {str(e.__traceback__)}"})) 
                    sys.stdout.flush()
                    return
                
            if action == 'next':
                try:
                    cur = traci.trafficlight.getPhase(tls_id)
                    num = traci.trafficlight.getPhaseNumber(tls_id)
                    new_phase = (cur + 1) % max(1, num)
                    
                    # Read the nominal duration from the traffic light program
                    program = traci.trafficlight.getCompleteRedYellowGreenDefinition(tls_id)
                    if program and len(program) > 0 and len(program[0].phases) > new_phase:
                        nominal_duration = program[0].phases[new_phase].duration
                    else:
                        nominal_duration = 30  # fallback duration
                    
                    # Jump to the phase
                    traci.trafficlight.setPhase(tls_id, new_phase)
                    
                    # Set the phase duration
                    traci.trafficlight.setPhaseDuration(tls_id, nominal_duration)
                    
                    # Advance simulation one step for immediate GUI update
                    traci.simulationStep()
                    
                    print(json.dumps({"type": "log", "level": "info", "message": f"TLS {tls_id}: changed from phase {cur} to {new_phase} with duration {nominal_duration}s"}))
                    sys.stdout.flush()
                    # Emit immediate TLS update
                    try:
                        emit_tls_update(tls_id)
                    except Exception:
                        pass
                except Exception as e:
                    print(json.dumps({"type": "log", "level": "error", "message": f"TLS {tls_id}: next failed: {e}"}))
                    sys.stdout.flush()
            elif action == 'prev':
                try:
                    cur = traci.trafficlight.getPhase(tls_id)
                    num = traci.trafficlight.getPhaseNumber(tls_id)
                    new_phase = (cur - 1 + max(1, num)) % max(1, num)
                    
                    # Read the nominal duration from the traffic light program
                    program = traci.trafficlight.getCompleteRedYellowGreenDefinition(tls_id)
                    if program and len(program) > 0 and len(program[0].phases) > new_phase:
                        nominal_duration = program[0].phases[new_phase].duration
                    else:
                        nominal_duration = 30  # fallback duration
                    
                    # Jump to the phase
                    traci.trafficlight.setPhase(tls_id, new_phase)
                    
                    # Set the phase duration
                    traci.trafficlight.setPhaseDuration(tls_id, nominal_duration)
                    
                    # Advance simulation one step for immediate GUI update
                    traci.simulationStep()
                    
                    print(json.dumps({"type": "log", "level": "info", "message": f"TLS {tls_id}: changed from phase {cur} to {new_phase} with duration {nominal_duration}s"}))
                    sys.stdout.flush()
                    # Emit immediate TLS update
                    try:
                        emit_tls_update(tls_id)
                    except Exception:
                        pass
                except Exception as e:
                    print(json.dumps({"type": "log", "level": "error", "message": f"TLS {tls_id}: prev failed: {e}"}))
                    sys.stdout.flush()
            elif action == 'set':
                try:
                    idx = int(cmd.get('phaseIndex'))
                    cur = traci.trafficlight.getPhase(tls_id)
                    num = traci.trafficlight.getPhaseNumber(tls_id)
                    print(json.dumps({"type": "log", "level": "info", "message": f"TLS {tls_id}: attempting to set phase {idx} (current: {cur}, max: {num-1})"}))
                    sys.stdout.flush()
                    
                    if 0 <= idx < max(1, num):
                        # Read the nominal duration from the traffic light program
                        program = traci.trafficlight.getCompleteRedYellowGreenDefinition(tls_id)
                        if program and len(program) > 0 and len(program[0].phases) > idx:
                            nominal_duration = program[0].phases[idx].duration
                        else:
                            nominal_duration = 30  # fallback duration
                        
                        # Jump to the phase
                        traci.trafficlight.setPhase(tls_id, idx)
                        
                        # Set the phase duration
                        traci.trafficlight.setPhaseDuration(tls_id, nominal_duration)
                        
                        # Advance simulation one step for immediate GUI update
                        traci.simulationStep()
                        
                        print(json.dumps({"type": "log", "level": "info", "message": f"TLS {tls_id}: successfully changed from phase {cur} to {idx} with duration {nominal_duration}s"}))
                        sys.stdout.flush()
                        # Emit immediate TLS update
                        try:
                            emit_tls_update(tls_id)
                        except Exception:
                            pass
                    else:
                        print(json.dumps({"type": "log", "level": "warn", "message": f"TLS {tls_id}: invalid phase index {idx} (valid range: 0-{num-1})"}))
                        sys.stdout.flush()
                except Exception as e:
                    print(json.dumps({"type": "log", "level": "error", "message": f"TLS {tls_id}: set failed: {e}"}))
                    sys.stdout.flush()
            elif action == 'resume':
                try:
                    # Re-attach to the current program and allow automatic progression
                    prog_id = traci.trafficlight.getProgram(tls_id)
                    cur = traci.trafficlight.getPhase(tls_id)
                    num = traci.trafficlight.getPhaseNumber(tls_id)

                    # Compute remaining time using nextSwitch; if invalid, fall back to nominal
                    nominal_duration = 30
                    remaining = 0
                    try:
                        sim_t = float(traci.simulation.getTime())
                        next_sw = float(traci.trafficlight.getNextSwitch(tls_id))
                        remaining = max(0.0, next_sw - sim_t)
                    except Exception:
                        remaining = 0

                    try:
                        defs = traci.trafficlight.getCompleteRedYellowGreenDefinition(tls_id)
                        chosen = None
                        for lg in defs:
                            pid = getattr(lg, 'programID', getattr(lg, 'programID', None))
                            if pid == prog_id or chosen is None:
                                chosen = lg
                        if chosen is not None and 0 <= cur < len(chosen.phases):
                            nominal_duration = float(getattr(chosen.phases[cur], 'duration', 30) or 30)
                    except Exception:
                        pass

                    # If remaining looks invalid (0 or huge), use nominal
                    resume_duration = nominal_duration
                    try:
                        if 0 < remaining < 3600:
                            resume_duration = remaining
                    except Exception:
                        pass

                    print(json.dumps({"type": "log", "level": "info", "message": f"TLS {tls_id}: resuming program '{prog_id}' at phase {cur} with duration {resume_duration}s (nominal={nominal_duration}, remaining={remaining})"}))
                    sys.stdout.flush()

                    # Re-apply program and phase to leave manual state mode
                    try:
                        traci.trafficlight.setProgram(tls_id, prog_id)
                    except Exception:
                        pass
                    # Clamp current phase index
                    if num <= 0:
                        num = 1
                    cur = max(0, min(cur, num - 1))
                    traci.trafficlight.setPhase(tls_id, cur)
                    # Seed a small duration if resume_duration is 0 to ensure countdown begins
                    traci.trafficlight.setPhaseDuration(tls_id, max(1.0, float(resume_duration)))

                    # Advance simulation one step for immediate GUI update
                    traci.simulationStep()

                    # Emit immediate TLS update
                    try:
                        emit_tls_update(tls_id)
                    except Exception:
                        pass
                except Exception as e:
                    print(json.dumps({"type": "log", "level": "error", "message": f"TLS {tls_id}: resume failed: {e}"}))
                    sys.stdout.flush()
            elif action == 'reset':
                try:
                    # Reset controller to the first available program/phase
                    defs = traci.trafficlight.getCompleteRedYellowGreenDefinition(tls_id)
                    prog_id = None
                    nominal = 30
                    if defs and len(defs) > 0:
                        chosen = defs[0]
                        prog_id = getattr(chosen, 'programID', getattr(chosen, 'programID', '0'))
                        try:
                            first = chosen.phases[0]
                            nominal = float(getattr(first, 'duration', 30) or 30)
                        except Exception:
                            pass
                    if prog_id is None:
                        try:
                            prog_id = traci.trafficlight.getProgram(tls_id)
                        except Exception:
                            prog_id = '0'
                    print(json.dumps({"type": "log", "level": "info", "message": f"TLS {tls_id}: resetting to program '{prog_id}' phase 0 with duration {nominal}s"}))
                    sys.stdout.flush()
                    try:
                        traci.trafficlight.setProgram(tls_id, prog_id)
                    except Exception:
                        pass
                    traci.trafficlight.setPhase(tls_id, 0)
                    traci.trafficlight.setPhaseDuration(tls_id, max(1.0, float(nominal)))
                    traci.simulationStep()
                    try:
                        emit_tls_update(tls_id)
                    except Exception:
                        pass
                except Exception as e:
                    print(json.dumps({"type": "log", "level": "error", "message": f"TLS {tls_id}: reset failed: {e}"}))
                    sys.stdout.flush()
            else:
                print(json.dumps({"type": "log", "level": "warn", "message": f"Unknown TLS action: {action}"}))
                sys.stdout.flush()
        except Exception as e:
            print(json.dumps({"type": "log", "level": "error", "message": f"handle_command failed: {e}"}))
            sys.stdout.flush()

    # RL mode: run targeted env with PPO model controlling traffic lights
    if args.rl_model:
        try:
            from stable_baselines3 import PPO
            # Import targeted env from Sumoconfigs or current path
            sys.path.append(os.path.dirname(os.path.abspath(__file__)))
            # Also include project Sumoconfigs (one level up)
            project_root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
            sumo_confs = os.path.join(project_root, 'Sumoconfigs')
            if os.path.isdir(sumo_confs) and sumo_confs not in sys.path:
                sys.path.append(sumo_confs)
            from addis_targeted_env import AddisTargetedEnvironment
        except Exception as e:
            print(json.dumps({"type": "error", "message": f"Failed to import RL env/model: {e}"}))
            sys.stdout.flush()
            sys.exit(1)

        # Emit static net payload once
        net_path = resolve_net_path_from_cfg(args.sumo_cfg)
        geo_ref = None
        if net_path:
            net_payload = build_network_payload(net_path)
            try:
                net = readNet(net_path)
                if hasattr(net, 'convertXY2LonLat'):
                    geo_ref = net
                    for lane in net_payload.get('lanes', []):
                        lonlat = []
                        for pt in lane['points']:
                            lon, lat = net.convertXY2LonLat(pt['x'], pt['y'])
                            lonlat.append({'lon': float(lon), 'lat': float(lat)})
                        lane['lonlat'] = lonlat
                    b = net_payload['bounds']
                    minLon, minLat = net.convertXY2LonLat(b['minX'], b['minY'])
                    maxLon, maxLat = net.convertXY2LonLat(b['maxX'], b['maxY'])
                    net_payload['geoBounds'] = {
                        'minLon': float(minLon), 'minLat': float(minLat),
                        'maxLon': float(maxLon), 'maxLat': float(maxLat)
                    }
            except Exception:
                pass
            print(json.dumps(net_payload))
            sys.stdout.flush()

        # Initialize env and model
        env = AddisTargetedEnvironment(
            sumocfg_file=args.sumo_cfg,
            use_gui=bool(args.rl_use_gui),
            num_seconds=7200,
            delta_time=int(args.rl_delta),
            control_mode='rl'
        )
        model = PPO.load(args.rl_model, device='cpu')

        # Determine expected observation dimension from model if available
        try:
            expected_dim = int(getattr(getattr(model, 'observation_space', None), 'shape', [72])[0])
        except Exception:
            expected_dim = 72

        def adapt_observation(ob, target_dim: int):
            try:
                arr = np.asarray(ob, dtype=np.float32).reshape(-1)
                if arr.shape[0] == target_dim:
                    return arr
                if arr.shape[0] > target_dim:
                    print(json.dumps({"type": "log", "level": "warn", "message": f"Obs dim {arr.shape[0]} > {target_dim}; slicing."})); sys.stdout.flush()
                    return arr[:target_dim]
                # pad with zeros
                pad = np.zeros((target_dim - arr.shape[0],), dtype=np.float32)
                print(json.dumps({"type": "log", "level": "warn", "message": f"Obs dim {arr.shape[0]} < {target_dim}; padding."})); sys.stdout.flush()
                return np.concatenate([arr, pad], axis=0)
            except Exception as e:
                print(json.dumps({"type": "log", "level": "warn", "message": f"Failed to adapt obs: {e}"})); sys.stdout.flush()
                return ob

        # Reset and run loop
        obs, info = env.reset()
        obs = adapt_observation(obs, expected_dim)
        step = 0
        try:
            while True:
                # Ensure observation matches model expectation
                obs_in = adapt_observation(obs, expected_dim)
                action, _ = model.predict(obs_in, deterministic=True)
                # Ensure actions are at least 1D (env slices with actions[:len(tls_ids)])
                try:
                    act_arr = np.asarray(action)
                    if act_arr.ndim == 0:
                        actions_vec = act_arr.reshape(1)
                    elif act_arr.ndim > 1:
                        actions_vec = act_arr.flatten()
                    else:
                        actions_vec = act_arr
                except Exception:
                    actions_vec = np.array([action])
                obs, reward, done, truncated, info = env.step(actions_vec)
                obs = adapt_observation(obs, expected_dim)
                step = info.get('simulation_step', step + int(args.rl_delta))

                # Collect vehicles
                vehicles = []
                try:
                    ids = traci.vehicle.getIDList()
                    vehicle_ids = ids
                    for vid in ids:
                        x, y = traci.vehicle.getPosition(vid)
                        speed = traci.vehicle.getSpeed(vid)
                        ang = traci.vehicle.getAngle(vid)
                        item = {'id': vid, 'x': x, 'y': y, 'speed': speed, 'angle': ang}
                        if geo_ref is not None:
                            try:
                                lon, lat = geo_ref.convertXY2LonLat(x, y)
                                item['lon'] = float(lon); item['lat'] = float(lat)
                            except Exception:
                                pass
                        vehicles.append(item)
                except Exception:
                    pass

                # Collect TLS states
                tls_states = []
                try:
                    for junction_id in traci.trafficlight.getIDList():
                        state = traci.trafficlight.getRedYellowGreenState(junction_id)
                        # Use friendly tlLogic ID if available, otherwise use junction ID
                        display_id = junction_to_tllogic.get(junction_id, junction_id)
                        tls_obj = {'id': display_id, 'state': state}
                        
                        # Store the junction_id for internal use if needed
                        if display_id != junction_id:
                            tls_obj['junction_id'] = junction_id
                        # Timing info
                        try:
                            sim_t = float(traci.simulation.getTime())
                            cur_idx = int(traci.trafficlight.getPhase(junction_id))
                            num_phases = int(traci.trafficlight.getPhaseNumber(junction_id))
                            next_sw = float(traci.trafficlight.getNextSwitch(junction_id))
                            remaining = max(0.0, next_sw - sim_t)
                            nxt_idx = (cur_idx + 1) % max(1, num_phases)
                            tls_obj['timing'] = {
                                'currentIndex': cur_idx,
                                'numPhases': num_phases,
                                'remaining': remaining,
                                'nextIndex': nxt_idx,
                                'nextSwitch': next_sw,
                                'simTime': sim_t
                            }
                        except Exception:
                            pass
                        # Program definition
                        try:
                            prog_id = traci.trafficlight.getProgram(junction_id)
                            phases_info = []
                            try:
                                defs = traci.trafficlight.getCompleteRedYellowGreenDefinition(junction_id)
                                chosen = None
                                for lg in defs:
                                    pid = getattr(lg, 'programID', getattr(lg, 'programID', None))
                                    if pid == prog_id or chosen is None:
                                        chosen = lg
                                if chosen is not None:
                                    for idx, ph in enumerate(getattr(chosen, 'phases', [])):
                                        try:
                                            phases_info.append({
                                                'index': idx,
                                                'state': getattr(ph, 'state', ''),
                                                'duration': float(getattr(ph, 'duration', 0) or 0),
                                                'minDur': float(getattr(ph, 'minDur', 0) or 0),
                                                'maxDur': float(getattr(ph, 'maxDur', 0) or 0)
                                            })
                                        except Exception:
                                            phases_info.append({'index': idx})
                            except Exception:
                                pass
                            tls_obj['program'] = { 'id': prog_id, 'phases': phases_info }
                        except Exception:
                            pass
                        # Approximate TLS center from controlled lanes
                        x_c = None; y_c = None
                        try:
                            controlled_lanes = traci.trafficlight.getControlledLanes(junction_id)
                            xs, ys, count = 0.0, 0.0, 0
                            for ln in controlled_lanes:
                                try:
                                    shape = traci.lane.getShape(ln)
                                    if shape:
                                        xs += float(shape[0][0]); ys += float(shape[0][1]); count += 1
                                except Exception:
                                    continue
                            if count > 0:
                                x_c = xs / count; y_c = ys / count
                                try:
                                    tls_obj['cx'] = float(x_c); tls_obj['cy'] = float(y_c)
                                except Exception:
                                    pass
                                if geo_ref is not None:
                                    try:
                                        lon, lat = geo_ref.convertXY2LonLat(x_c, y_c)
                                        tls_obj['lon'] = float(lon); tls_obj['lat'] = float(lat)
                                    except Exception:
                                        pass
                        except Exception:
                            pass
                        # Derive per-side (N,E,S,W) summary from controlled links ordering and current state
                        try:
                            links = traci.trafficlight.getControlledLinks(junction_id)
                            # links is list aligned with state entries
                            sides = {'N': 'r', 'E': 'r', 'S': 'r', 'W': 'r'}
                            lane_states = {}
                            lane_angles = {}
                            def side_bucket(dx, dy):
                                ang = degrees(atan2(dy, dx))
                                if -45 <= ang < 45:
                                    return 'E'
                                if 45 <= ang < 135:
                                    return 'N'
                                if -135 <= ang < -45:
                                    return 'S'
                                return 'W'
                            def choose(prev, val):
                                if prev is None:
                                    return val
                                if prev == 'g' or val == 'g':
                                    return 'g'
                                if prev == 'y' or val == 'y':
                                    return 'y'
                                return 'r'
                            for idx, link_group in enumerate(links):
                                if idx >= len(state):
                                    break
                                if not link_group:
                                    continue
                                inLane = link_group[0][0]
                                try:
                                    shape = traci.lane.getShape(inLane)
                                    if shape:
                                        px, py = shape[-1][0], shape[-1][1]
                                        if x_c is not None and y_c is not None:
                                            dx, dy = px - x_c, py - y_c
                                        else:
                                            dx, dy = px, py
                                        side = side_bucket(dx, dy)
                                        ch = state[idx].lower()
                                        val = 'g' if ch == 'g' else ('y' if ch == 'y' else 'r')
                                        cur = sides.get(side, 'r')
                                        if cur == 'r' or (cur == 'y' and val == 'g'):
                                            sides[side] = val
                                        lane_states[inLane] = choose(lane_states.get(inLane), val)
                                        lane_angles[inLane] = float(degrees(atan2(dy, dx)))
                                except Exception:
                                    continue
                            tls_obj['sides'] = sides
                            # lanes array for detailed popup rendering (include small shape near center)
                            lanes_arr = []
                            for ln in lane_states.keys():
                                try:
                                    shp = traci.lane.getShape(ln)
                                except Exception:
                                    shp = []
                                pts = []
                                try:
                                    if shp:
                                        seg = shp[-min(10, len(shp)):]  # last points approaching center
                                        for px, py in seg:
                                            pts.append({'x': float(px), 'y': float(py)})
                                except Exception:
                                    pass
                                lanes_arr.append({ 'id': ln, 'state': lane_states.get(ln, 'r'), 'angle': lane_angles.get(ln, 0.0), 'shape': pts })
                            tls_obj['lanes'] = lanes_arr
                            # Per-side turn states (L,S,R,U)
                            turns = {'N': {}, 'E': {}, 'S': {}, 'W': {}}
                            def classify_turn(a_in, a_out):
                                # normalize to [-180,180]
                                d = (a_out - a_in + 180.0) % 360.0 - 180.0
                                if abs(d) > 150:
                                    return 'U'
                                if -30 <= d <= 30:
                                    return 'S'
                                if d > 30:
                                    return 'L'
                                return 'R'
                            for idx, link_group in enumerate(links):
                                if idx >= len(state):
                                    break
                                if not link_group:
                                    continue
                                inLane = link_group[0][0]
                                outLane = link_group[0][1]
                                try:
                                    in_shape = traci.lane.getShape(inLane)
                                    out_shape = traci.lane.getShape(outLane)
                                except Exception:
                                    in_shape, out_shape = [], []
                                if not in_shape or not out_shape:
                                    continue
                                try:
                                    in_end = in_shape[-1]
                                    out_start = out_shape[0]
                                    a_in = degrees(atan2(in_end[1]-y_c, in_end[0]-x_c))
                                    a_out = degrees(atan2(out_start[1]-y_c, out_start[0]-x_c))
                                    side = side_bucket(in_end[0]-x_c, in_end[1]-y_c)
                                    turn = classify_turn(a_in, a_out)
                                    ch = state[idx].lower()
                                    val = 'g' if ch == 'g' else ('y' if ch == 'y' else 'r')
                                    prev = turns[side].get(turn)
                                    turns[side][turn] = choose(prev, val)
                                except Exception:
                                    continue
                            tls_obj['turns'] = turns
                        except Exception:
                            pass
                        tls_states.append(tls_obj)
                except Exception:
                    pass

                # Get simulation statistics
                try:
                    stats = {
                        'collisions': traci.simulation.getCollidingVehiclesNumber(),
                        'emergencyStops': traci.simulation.getEmergencyStoppingVehiclesNumber(),
                        'teleportStarts': traci.simulation.getStartingTeleportNumber(),
                        'teleportEnds': traci.simulation.getEndingTeleportNumber(),
                        'arrivals': traci.simulation.getArrivedNumber(),
                        'departures': traci.simulation.getDepartedNumber(),
                        'waitingTime': sum(traci.vehicle.getWaitingTime(vid) for vid in vehicle_ids),
                        'totalDistanceTraveled': sum(traci.vehicle.getDistance(vid) for vid in vehicle_ids)
                    }
                except Exception:
                    stats = {
                        'collisions': 0,
                        'emergencyStops': 0,
                        'teleportStarts': 0,
                        'teleportEnds': 0,
                        'arrivals': 0,
                        'departures': 0,
                        'waitingTime': 0,
                        'totalDistanceTraveled': 0
                    }

                payload = {
                    'type': 'viz',
                    'step': step,
                    'ts': int(time.time() * 1000),
                    'vehicles': vehicles,
                    'tls': tls_states,
                    'stats': stats
                }
                print(json.dumps(payload)); sys.stdout.flush()

                # Drain and handle any pending commands from stdin
                try:
                    while True:
                        cmd = cmd_queue.get_nowait()
                        handle_command(cmd, tllogic_to_junction)
                except Exception:
                    pass

                if done or truncated:
                    break
        except KeyboardInterrupt:
            pass
        except Exception as e:
            try:
                print(json.dumps({"type": "error", "message": str(e), "stack": traceback.format_exc()})); sys.stdout.flush()
            except Exception:
                print(json.dumps({"type": "error", "message": str(e)})); sys.stdout.flush()
        finally:
            try:
                env.close()
            except Exception:
                pass
        return

    # Default mode: run bridge without RL control
    sumoBinary = args.sumo_bin
    if sumoBinary.lower() in ['sumo', 'sumo-gui']:
        try:
            sumoBinary = checkBinary(args.sumo_bin)
        except Exception:
            pass

    sumoCmd = [
        sumoBinary,
        '-c', args.sumo_cfg,
        '--step-length', args.step_length,
        '--start'
    ]

    # Prepare network geometry
    net_path = resolve_net_path_from_cfg(args.sumo_cfg)

    traci.start(sumoCmd)
    # Emit network geometry once
    geo_ref = None
    if net_path:
        net_payload = build_network_payload(net_path)
        # Try to extract geo projection information, if available
        try:
            from sumolib.net import readNet
            net = readNet(net_path)
            # SUMO stores optional geo projection; if present, we can convert to lon/lat
            # Use net.convertXY2LonLat if available
            if hasattr(net, 'convertXY2LonLat'):
                geo_ref = net
                # Also include a simplified geo lanes preview (lon/lat) for Leaflet
                for lane in net_payload.get('lanes', []):
                    lonlat = []
                    for pt in lane['points']:
                        lon, lat = net.convertXY2LonLat(pt['x'], pt['y'])
                        lonlat.append({'lon': float(lon), 'lat': float(lat)})
                    lane['lonlat'] = lonlat
                b = net_payload['bounds']
                minLon, minLat = net.convertXY2LonLat(b['minX'], b['minY'])
                maxLon, maxLat = net.convertXY2LonLat(b['maxX'], b['maxY'])
                net_payload['geoBounds'] = {
                    'minLon': float(minLon),
                    'minLat': float(minLat),
                    'maxLon': float(maxLon),
                    'maxLat': float(maxLat)
                }
        except Exception:
            pass
        print(json.dumps(net_payload))
        sys.stdout.flush()

    step = 0
    try:
        while True:
            traci.simulationStep()
            step += 1
            vehicle_ids = traci.vehicle.getIDList()
            vehicles = []
            for vid in vehicle_ids:
                x, y = traci.vehicle.getPosition(vid)
                speed = traci.vehicle.getSpeed(vid)
                ang = traci.vehicle.getAngle(vid)  # degrees
                length = traci.vehicle.getLength(vid)
                width = traci.vehicle.getWidth(vid)
                vtype = traci.vehicle.getTypeID(vid)
                item = {
                    'id': vid,
                    'x': x,
                    'y': y,
                    'speed': speed,
                    'angle': ang,
                    'length': length,
                    'width': width,
                    'type': vtype
                }
                if geo_ref is not None:
                    try:
                        lon, lat = geo_ref.convertXY2LonLat(x, y)
                        item['lon'] = float(lon)
                        item['lat'] = float(lat)
                    except Exception:
                        pass
                vehicles.append(item)

            # Traffic light states with approximate geometry and per-side summary
            tls_states = []
            try:
                for junction_id in traci.trafficlight.getIDList():
                    state = traci.trafficlight.getRedYellowGreenState(junction_id)
                    # Use friendly tlLogic ID if available, otherwise use junction ID
                    display_id = junction_to_tllogic.get(junction_id, junction_id)
                    tls_obj = {'id': display_id, 'state': state}
                    
                    # Store the junction_id for internal use if needed
                    if display_id != junction_id:
                        tls_obj['junction_id'] = junction_id
                    # Timing info
                    try:
                        sim_t = float(traci.simulation.getTime())
                        cur_idx = int(traci.trafficlight.getPhase(junction_id))
                        num_phases = int(traci.trafficlight.getPhaseNumber(junction_id))
                        next_sw = float(traci.trafficlight.getNextSwitch(junction_id))
                        remaining = max(0.0, next_sw - sim_t)
                        nxt_idx = (cur_idx + 1) % max(1, num_phases)
                        tls_obj['timing'] = {
                            'currentIndex': cur_idx,
                            'numPhases': num_phases,
                            'remaining': remaining,
                            'nextIndex': nxt_idx,
                            'nextSwitch': next_sw,
                            'simTime': sim_t
                        }
                    except Exception:
                        pass
                    # Program definition
                    try:
                        prog_id = traci.trafficlight.getProgram(junction_id)
                        phases_info = []
                        try:
                            defs = traci.trafficlight.getCompleteRedYellowGreenDefinition(junction_id)
                            chosen = None
                            for lg in defs:
                                pid = getattr(lg, 'programID', getattr(lg, 'programID', None))
                                if pid == prog_id or chosen is None:
                                    chosen = lg
                            if chosen is not None:
                                for idx, ph in enumerate(getattr(chosen, 'phases', [])):
                                    try:
                                        phases_info.append({
                                            'index': idx,
                                            'state': getattr(ph, 'state', ''),
                                            'duration': float(getattr(ph, 'duration', 0) or 0),
                                            'minDur': float(getattr(ph, 'minDur', 0) or 0),
                                            'maxDur': float(getattr(ph, 'maxDur', 0) or 0)
                                        })
                                    except Exception:
                                        phases_info.append({'index': idx})
                        except Exception:
                            pass
                        tls_obj['program'] = { 'id': prog_id, 'phases': phases_info }
                    except Exception:
                        pass
                    # Approximate TLS center from controlled lanes
                    x_c = None; y_c = None
                    try:
                        controlled_lanes = traci.trafficlight.getControlledLanes(junction_id)
                        xs, ys, count = 0.0, 0.0, 0
                        for ln in controlled_lanes:
                            try:
                                shape = traci.lane.getShape(ln)
                                if shape:
                                    xs += float(shape[0][0])
                                    ys += float(shape[0][1])
                                    count += 1
                            except Exception:
                                continue
                        if count > 0:
                            x_c = xs / count
                            y_c = ys / count
                            try:
                                tls_obj['cx'] = float(x_c); tls_obj['cy'] = float(y_c)
                            except Exception:
                                pass
                            if geo_ref is not None:
                                try:
                                    lon, lat = geo_ref.convertXY2LonLat(x_c, y_c)
                                    tls_obj['lon'] = float(lon)
                                    tls_obj['lat'] = float(lat)
                                except Exception:
                                    pass
                    except Exception:
                        pass
                    # Per-side summary
                    try:
                        links = traci.trafficlight.getControlledLinks(junction_id)
                        sides = {'N': 'r', 'E': 'r', 'S': 'r', 'W': 'r'}
                        lane_states = {}
                        lane_angles = {}
                        def side_bucket(dx, dy):
                            ang = degrees(atan2(dy, dx))
                            if -45 <= ang < 45:
                                return 'E'
                            if 45 <= ang < 135:
                                return 'N'
                            if -135 <= ang < -45:
                                return 'S'
                            return 'W'
                        def choose(prev, val):
                            if prev is None:
                                return val
                            if prev == 'g' or val == 'g':
                                return 'g'
                            if prev == 'y' or val == 'y':
                                return 'y'
                            return 'r'
                        for idx, link_group in enumerate(links):
                            if idx >= len(state):
                                break
                            if not link_group:
                                continue
                            inLane = link_group[0][0]
                            try:
                                shape = traci.lane.getShape(inLane)
                                if shape:
                                    px, py = shape[-1][0], shape[-1][1]
                                    if x_c is not None and y_c is not None:
                                        dx, dy = px - x_c, py - y_c
                                    else:
                                        dx, dy = px, py
                                    side = side_bucket(dx, dy)
                                    ch = state[idx].lower()
                                    val = 'g' if ch == 'g' else ('y' if ch == 'y' else 'r')
                                    cur = sides.get(side, 'r')
                                    if cur == 'r' or (cur == 'y' and val == 'g'):
                                        sides[side] = val
                                    lane_states[inLane] = choose(lane_states.get(inLane), val)
                                    lane_angles[inLane] = float(degrees(atan2(dy, dx)))
                            except Exception:
                                continue
                        tls_obj['sides'] = sides
                        lanes_arr = []
                        for ln in lane_states.keys():
                            try:
                                shp = traci.lane.getShape(ln)
                            except Exception:
                                shp = []
                            pts = []
                            try:
                                if shp:
                                    seg = shp[-min(10, len(shp)):]  # last points approaching center
                                    for px, py in seg:
                                        pts.append({'x': float(px), 'y': float(py)})
                            except Exception:
                                pass
                            lanes_arr.append({ 'id': ln, 'state': lane_states.get(ln, 'r'), 'angle': lane_angles.get(ln, 0.0), 'shape': pts })
                        tls_obj['lanes'] = lanes_arr
                        # Per-side turn states (L,S,R,U)
                        turns = {'N': {}, 'E': {}, 'S': {}, 'W': {}}
                        def classify_turn(a_in, a_out):
                            d = (a_out - a_in + 180.0) % 360.0 - 180.0
                            if abs(d) > 150:
                                return 'U'
                            if -30 <= d <= 30:
                                return 'S'
                            if d > 30:
                                return 'L'
                            return 'R'
                        for idx, link_group in enumerate(links):
                            if idx >= len(state):
                                break
                            if not link_group:
                                continue
                            inLane = link_group[0][0]
                            outLane = link_group[0][1]
                            try:
                                in_shape = traci.lane.getShape(inLane)
                                out_shape = traci.lane.getShape(outLane)
                            except Exception:
                                in_shape, out_shape = [], []
                            if not in_shape or not out_shape:
                                continue
                            try:
                                in_end = in_shape[-1]
                                out_start = out_shape[0]
                                a_in = degrees(atan2(in_end[1]-y_c, in_end[0]-x_c))
                                a_out = degrees(atan2(out_start[1]-y_c, out_start[0]-x_c))
                                side = side_bucket(in_end[0]-x_c, in_end[1]-y_c)
                                turn = classify_turn(a_in, a_out)
                                ch = state[idx].lower()
                                val = 'g' if ch == 'g' else ('y' if ch == 'y' else 'r')
                                prev = turns[side].get(turn)
                                if 'choose' in globals():
                                    turns[side][turn] = choose(prev, val)
                                else:
                                    turns[side][turn] = val
                            except Exception:
                                continue
                        tls_obj['turns'] = turns
                    except Exception:
                        pass
                    tls_states.append(tls_obj)
            except Exception:
                pass

            # Get simulation statistics
            try:
                stats = {
                    'collisions': traci.simulation.getCollidingVehiclesNumber(),
                    'emergencyStops': traci.simulation.getEmergencyStoppingVehiclesNumber(),
                    'teleportStarts': traci.simulation.getStartingTeleportNumber(),
                    'teleportEnds': traci.simulation.getEndingTeleportNumber(),
                    'arrivals': traci.simulation.getArrivedNumber(),
                    'departures': traci.simulation.getDepartedNumber(),
                    'waitingTime': sum(traci.vehicle.getWaitingTime(vid) for vid in vehicle_ids),
                    'totalDistanceTraveled': sum(traci.vehicle.getDistance(vid) for vid in vehicle_ids)
                }
            except Exception:
                stats = {
                    'collisions': 0,
                    'emergencyStops': 0,
                    'teleportStarts': 0,
                    'teleportEnds': 0,
                    'arrivals': 0,
                    'departures': 0,
                    'waitingTime': 0,
                    'totalDistanceTraveled': 0
                }

            payload = {
                'type': 'viz',
                'step': step,
                'ts': int(time.time() * 1000),
                'vehicles': vehicles,
                'tls': tls_states,
                'stats': stats
            }
            print(json.dumps(payload))
            sys.stdout.flush()

            # Drain and handle any pending commands from stdin
            try:
                while True:
                    cmd = cmd_queue.get_nowait()
                    print(json.dumps({"type": "log", "level": "info", "message": f"Processing command: {cmd}"}))
                    sys.stdout.flush()
                    handle_command(cmd, tllogic_to_junction)
            except queue.Empty:
                # No more commands to process, this is normal
                pass
            except Exception as e:
                print(json.dumps({"type": "log", "level": "error", "message": f"Command processing error: {e}"}))
                sys.stdout.flush()

    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(json.dumps({"type": "error", "message": str(e)}))
        sys.stdout.flush()
    finally:
        try:
            traci.close(False)
        except Exception:
            pass
        try:
            traci.close(False)
        except Exception:
            pass


if __name__ == '__main__':
    main()
