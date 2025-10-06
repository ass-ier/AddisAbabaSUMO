#!/usr/bin/env python3
import os
import sys
import json
import time
import argparse
import xml.etree.ElementTree as ET
from math import cos, sin, radians, atan2, degrees

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

        # Reset and run loop
        obs, info = env.reset()
        step = 0
        try:
            while True:
                action, _ = model.predict(obs, deterministic=True)
                obs, reward, done, truncated, info = env.step(action)
                step = info.get('simulation_step', step + int(args.rl_delta))

                # Collect vehicles
                vehicles = []
                try:
                    ids = traci.vehicle.getIDList()
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
                    for tls_id in traci.trafficlight.getIDList():
                        state = traci.trafficlight.getRedYellowGreenState(tls_id)
                        tls_obj = {'id': tls_id, 'state': state}
                        # Approximate TLS center from controlled lanes
                        x_c = None; y_c = None
                        try:
                            controlled_lanes = traci.trafficlight.getControlledLanes(tls_id)
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
                            links = traci.trafficlight.getControlledLinks(tls_id)
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

                payload = {
                    'type': 'viz',
                    'step': step,
                    'ts': int(time.time() * 1000),
                    'vehicles': vehicles,
                    'tls': tls_states
                }
                print(json.dumps(payload)); sys.stdout.flush()

                if done or truncated:
                    break
        except KeyboardInterrupt:
            pass
        except Exception as e:
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
                for tls_id in traci.trafficlight.getIDList():
                    state = traci.trafficlight.getRedYellowGreenState(tls_id)
                    tls_obj = {'id': tls_id, 'state': state}
                    # Approximate TLS center from controlled lanes
                    x_c = None; y_c = None
                    try:
                        controlled_lanes = traci.trafficlight.getControlledLanes(tls_id)
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
                        links = traci.trafficlight.getControlledLinks(tls_id)
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

            payload = {
                'type': 'viz',
                'step': step,
                'ts': int(time.time() * 1000),
                'vehicles': vehicles,
                'tls': tls_states
            }
            print(json.dumps(payload))
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
