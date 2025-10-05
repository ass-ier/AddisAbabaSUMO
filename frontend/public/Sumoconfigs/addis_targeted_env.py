"""
Addis Ababa Targeted Traffic Light RL Environment
================================================

Focused RL training on specific traffic light intersections:
- megenagna, abem, salitemihret, shola1, shola2, bolebrass, tikuranbesa

Features:
1. Targeted training on predefined TLS IDs
2. Built-in fixed-time baseline comparison
3. Optimized for fast, efficient training
4. Comprehensive evaluation metrics
"""

import os
import sys
import numpy as np
import pandas as pd
from collections import defaultdict, deque
from typing import Dict, List, Tuple, Optional, Any
import gymnasium as gym
from gymnasium import spaces
import warnings

# SUMO imports
if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(tools)
else:
    sys.exit("Please declare environment variable 'SUMO_HOME'")

import traci
import sumolib

# Safe print for Windows consoles that can't encode emojis
def _safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        try:
            print(str(msg).encode('ascii', 'ignore').decode('ascii'))
        except Exception:
            pass

class TargetedTrafficLightManager:
    """Enhanced traffic light manager for specific intersections"""
    
    def __init__(self, tls_id: str, phases: List, min_green_time: int = 10, 
                 max_red_time: int = 90, yellow_time: int = 4):
        self.tls_id = tls_id
        self.phases = phases
        self.min_green_time = min_green_time
        self.max_red_time = max_red_time
        self.yellow_time = yellow_time
        
        # State tracking
        self.current_phase = 0
        self.time_since_last_switch = 0
        self.phase_start_time = 0
        
        # Performance metrics
        self.total_throughput = 0
        self.total_waiting_time = 0
        self.phase_switches = 0
        
        # Fairness tracking
        self.lane_last_green = defaultdict(lambda: -max_red_time)
        self.emergency_switches = 0
        self.emergency_cooldown = 20  # 20 second cooldown
        self.last_emergency_switch = -90
        
        # Get controlled lanes and phases
        self.controlled_lanes = self._get_controlled_lanes()
        self.green_phases = self._identify_green_phases()
        
        _safe_print(f"TLS {tls_id}: {len(self.controlled_lanes)} lanes, {len(self.green_phases)} green phases")
        
    def _get_controlled_lanes(self) -> List[str]:
        """Get lanes controlled by this traffic light"""
        try:
            controlled_links = traci.trafficlight.getControlledLinks(self.tls_id)
            lanes = set()
            
            for link_list in controlled_links:
                for link in link_list:
                    if link[0]:  # incoming lane
                        lanes.add(link[0])
            
            return list(lanes)[:12]  # Limit to 12 lanes max for efficiency
            
        except Exception as e:
            print(f"Warning: Could not get lanes for {self.tls_id}: {e}")
            return []
    
    def _identify_green_phases(self) -> List[int]:
        """Identify green phases"""
        green_phases = []
        for i, phase in enumerate(self.phases):
            if 'G' in phase.state or 'g' in phase.state:
                green_phases.append(i)
        return green_phases if green_phases else list(range(min(len(self.phases), 6)))
    
    def can_switch_phase(self, current_time: int) -> bool:
        """Check if phase can be switched"""
        time_in_phase = current_time - self.phase_start_time
        return time_in_phase >= self.min_green_time
    
    def needs_emergency_switch(self, current_time: int) -> Tuple[bool, Optional[int]]:
        """Check for emergency switch with cooldown"""
        if current_time - self.last_emergency_switch < self.emergency_cooldown:
            return False, None
        
        current_green_lanes = self._get_current_green_lanes()
        max_starvation = 0
        starved_lane = None
        
        for lane in self.controlled_lanes:
            if lane not in current_green_lanes:
                starvation_time = current_time - self.lane_last_green[lane]
                if starvation_time > self.max_red_time * 0.8 and starvation_time > max_starvation:
                    max_starvation = starvation_time
                    starved_lane = lane
        
        if starved_lane:
            best_phase = self._find_best_phase_for_lane(starved_lane)
            if best_phase is not None and best_phase != self.current_phase:
                self.last_emergency_switch = current_time
                self.emergency_switches += 1
                return True, best_phase
        
        return False, None
    
    def _get_current_green_lanes(self) -> List[str]:
        """Get currently green lanes"""
        try:
            current_state = traci.trafficlight.getRedYellowGreenState(self.tls_id)
            controlled_links = traci.trafficlight.getControlledLinks(self.tls_id)
            
            green_lanes = []
            for i, (state_char, link_list) in enumerate(zip(current_state, controlled_links)):
                if state_char in ['G', 'g']:
                    for link in link_list:
                        if link[0] not in green_lanes:
                            green_lanes.append(link[0])
            return green_lanes
        except:
            return []
    
    def _find_best_phase_for_lane(self, lane: str) -> Optional[int]:
        """Find best green phase for a lane"""
        try:
            controlled_links = traci.trafficlight.getControlledLinks(self.tls_id)
            
            for phase_idx in self.green_phases:
                phase_state = self.phases[phase_idx].state
                for i, (state_char, link_list) in enumerate(zip(phase_state, controlled_links)):
                    if state_char in ['G', 'g']:
                        for link in link_list:
                            if link[0] == lane:
                                return phase_idx
            return None
        except:
            return None
    
    def get_lane_metrics(self) -> Dict[str, Dict[str, float]]:
        """Get lane metrics with capping for stability"""
        metrics = {}
        
        for lane in self.controlled_lanes:
            try:
                vehicle_count = min(traci.lane.getLastStepVehicleNumber(lane), 30)
                queue_length = min(traci.lane.getLastStepHaltingNumber(lane), 20)
                waiting_time = min(traci.lane.getWaitingTime(lane), 180)  # Cap at 3 minutes
                mean_speed = traci.lane.getLastStepMeanSpeed(lane)
                lane_length = max(traci.lane.getLength(lane), 1)
                
                metrics[lane] = {
                    'vehicle_count': vehicle_count,
                    'queue_length': queue_length,
                    'waiting_time': waiting_time,
                    'mean_speed': mean_speed,
                    'occupancy': min(vehicle_count * 5.0 / lane_length, 1.0),
                    'density': min(vehicle_count / (lane_length / 1000), 50),
                    'flow_rate': min(vehicle_count * mean_speed, 300) if mean_speed > 0 else 0
                }
            except:
                metrics[lane] = {
                    'vehicle_count': 0, 'queue_length': 0, 'waiting_time': 0,
                    'mean_speed': 0, 'occupancy': 0, 'density': 0, 'flow_rate': 0
                }
        
        return metrics
    
    def update_fairness_metrics(self, current_time: int):
        """Update fairness tracking"""
        current_green_lanes = self._get_current_green_lanes()
        for lane in self.controlled_lanes:
            if lane in current_green_lanes:
                self.lane_last_green[lane] = current_time


class AddisTargetedEnvironment(gym.Env):
    """
    Targeted RL environment for specific Addis Ababa intersections
    """
    
    metadata = {"render_modes": ["human"], "render_fps": 4}
    
    def __init__(self, 
                 net_file: str = "AddisAbaba.net.xml",
                 route_file: str = "addisTrafficFullNetwork.rou.xml",
                 sumocfg_file: str = "AddisAbabaSimple.sumocfg",
                 use_gui: bool = False,
                 num_seconds: int = 1800,  # 30 minutes default
                 delta_time: int = 15,     # 15-second intervals for efficiency
                 target_tls_ids: List[str] = None,
                 control_mode: str = 'rl'):
        
        self.net_file = net_file
        self.route_file = route_file
        self.sumocfg_file = sumocfg_file
        self.use_gui = use_gui
        self.num_seconds = num_seconds
        self.delta_time = delta_time
        self.control_mode = control_mode  # 'rl' -> agent controls; 'sumo_default' -> SUMO's TL logic
        
        # Targeted traffic light IDs
        self.target_tls_ids = target_tls_ids or [
            'megenagna', 'abem', 'salitemihret', 'shola1', 
            'shola2', 'bolebrass', 'tikuranbesa'
        ]
        
        # Environment state
        self.simulation_step = 0
        self.traffic_lights = {}
        self.episode_reward = 0
        self.emergency_switches_total = 0
        
        # Fixed action and observation spaces for the 7 specific TLS
        n_tls = len(self.target_tls_ids)
        self.action_space = spaces.MultiDiscrete([2] * n_tls)  # Keep/Switch for each TLS
        
        # Observation: 7 TLS * (2 TLS features + 12 lanes * 7 metrics) + 5 global = 7*86 + 5 = 607
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(607,), dtype=np.float32
        )
        
        _safe_print(f"Targeting {n_tls} specific traffic lights: {', '.join(self.target_tls_ids)}")
        
    def _start_sumo(self):
        """Start SUMO simulation"""
        sumo_cmd = ["sumo-gui" if self.use_gui else "sumo"]
        sumo_cmd.extend(["-c", self.sumocfg_file])
        sumo_cmd.extend([
            "--waiting-time-memory", "10000",
            "--time-to-teleport", "600",
            "--no-step-log", "true",
            "--no-warnings", "true",
            "--duration-log.disable", "true",
            "--start"
        ])
        
        try:
            traci.start(sumo_cmd)
        except Exception as e:
            _safe_print(f"Error starting SUMO: {e}")
            raise
    
    def _detect_and_initialize_target_tls(self):
        """Initialize only the targeted traffic lights"""
        all_tls_ids = traci.trafficlight.getIDList()
        print(f"Available TLS: {len(all_tls_ids)} total")
        
        found_tls = []
        missing_tls = []
        
        for target_id in self.target_tls_ids:
            if target_id in all_tls_ids:
                try:
                    programs = traci.trafficlight.getAllProgramLogics(target_id)
                    if programs:
                        program = programs[0]
                        phases = program.phases
                        
                        self.traffic_lights[target_id] = TargetedTrafficLightManager(
                            tls_id=target_id,
                            phases=phases,
                            min_green_time=10,
                            max_red_time=90,
                            yellow_time=4
                        )
                        found_tls.append(target_id)
                        
                except Exception as e:
                    _safe_print(f"Could not initialize {target_id}: {e}")
                    missing_tls.append(target_id)
            else:
                missing_tls.append(target_id)
        
        if missing_tls:
            _safe_print(f"Missing TLS: {missing_tls}")
            _safe_print(f"Available TLS that might match: {[tls for tls in all_tls_ids if any(target in tls.lower() for target in missing_tls)]}")
        
        _safe_print(f"Successfully initialized {len(found_tls)} targeted traffic lights")
        return found_tls
    
    def reset(self, seed=None, options=None):
        """Reset environment"""
        super().reset(seed=seed)
        
        try:
            if traci.isLoaded():
                traci.close()
        except:
            pass
        
        self._start_sumo()
        
        # Let SUMO stabilize
        for _ in range(3):
            traci.simulationStep()
        try:
            expected = traci.simulation.getMinExpectedNumber()
        except:
            expected = -1
        _safe_print(f"Reset: after warmup steps, expected vehicles={expected}")
        
        found_tls = self._detect_and_initialize_target_tls()
        
        self.simulation_step = 0
        self.episode_reward = 0
        self.emergency_switches_total = 0
        
        # Initialize TLS states
        for tls in self.traffic_lights.values():
            tls.phase_start_time = 0
            tls.time_since_last_switch = 0
            tls.last_emergency_switch = -90
            tls.emergency_switches = 0
        
        observation = self._get_observation()
        info = self._get_info()
        info['initialized_tls'] = found_tls
        
        return observation, info
    
    def step(self, actions):
        """Execute environment step"""
        # Debug: print pre-step expected
        try:
            _safe_print(f"STEP: begin sim_step={self.simulation_step} expected={traci.simulation.getMinExpectedNumber()}")
        except:
            _safe_print(f"STEP: begin sim_step={self.simulation_step} expected=?")
        # Normalize actions
        if actions is None:
            actions = []
        elif not isinstance(actions, (list, np.ndarray)):
            actions = [actions]
        
        # Execute actions (only when RL is controlling)
        rewards = []
        if self.control_mode == 'rl':
            tls_ids = list(self.traffic_lights.keys())
            for i, (tls_id, action) in enumerate(zip(tls_ids, actions[:len(tls_ids)])):
                if tls_id in self.traffic_lights:
                    tls = self.traffic_lights[tls_id]
                    reward = self._execute_action(tls, action)
                    rewards.append(reward)
        
        # Advance simulation
        for _ in range(self.delta_time):
            traci.simulationStep()
            self.simulation_step += 1
        
        # Update metrics
        self._update_all_metrics()
        # Handle emergency switches only in RL control mode
        if self.control_mode == 'rl':
            self._handle_emergency_switches()
        
        observation = self._get_observation()
        total_reward = np.mean(rewards) if rewards else 0
        self.episode_reward += total_reward
        
        # Check termination with warmup guard to avoid premature stop before vehicles spawn
        min_warmup = 60  # seconds
        remaining = 0
        try:
            remaining = traci.simulation.getMinExpectedNumber()
        except:
            remaining = 0
        time_done = self.simulation_step >= self.num_seconds
        empty_done = (self.simulation_step >= min_warmup and remaining <= 0)
        done = time_done or empty_done
        if done:
            reason = "time" if time_done else f"empty_after_warmup expected={remaining}"
            _safe_print(f"STEP: done at sim_step={self.simulation_step} reason={reason}")
        
        info = self._get_info()
        
        return observation, total_reward, done, False, info
    
    def _execute_action(self, tls: TargetedTrafficLightManager, action: int) -> float:
        """Execute action for a traffic light"""
        reward = 0
        
        # Check emergency switch first
        needs_emergency, emergency_phase = tls.needs_emergency_switch(self.simulation_step)
        
        if needs_emergency and emergency_phase is not None:
            if tls.can_switch_phase(self.simulation_step):
                self._switch_to_phase(tls, emergency_phase)
                reward += 2  # Small emergency bonus
        elif action == 1 and tls.can_switch_phase(self.simulation_step):
            # RL-controlled switch
            next_phase = self._get_next_optimal_phase(tls)
            if next_phase != tls.current_phase:
                self._switch_to_phase(tls, next_phase)
                reward += 0.5  # Small action bonus
        
        # Calculate state-based reward
        reward += self._calculate_reward(tls)
        
        return reward
    
    def _switch_to_phase(self, tls: TargetedTrafficLightManager, target_phase: int):
        """Switch traffic light phase"""
        try:
            if target_phase >= len(tls.phases):
                target_phase = target_phase % len(tls.phases)
            
            traci.trafficlight.setPhase(tls.tls_id, target_phase)
            tls.current_phase = target_phase
            tls.phase_start_time = self.simulation_step
            tls.time_since_last_switch = 0
            tls.phase_switches += 1
        except Exception as e:
            print(f"Error switching {tls.tls_id}: {e}")
    
    def _get_next_optimal_phase(self, tls: TargetedTrafficLightManager) -> int:
        """Get optimal next phase"""
        lane_metrics = tls.get_lane_metrics()
        
        best_phase = (tls.current_phase + 1) % len(tls.green_phases) if tls.green_phases else tls.current_phase
        best_score = -float('inf')
        
        for phase_idx in tls.green_phases:
            if phase_idx == tls.current_phase:
                continue
            
            score = self._evaluate_phase_score(tls, phase_idx, lane_metrics)
            if score > best_score:
                best_score = score
                best_phase = phase_idx
        
        return best_phase
    
    def _evaluate_phase_score(self, tls: TargetedTrafficLightManager, phase_idx: int, 
                             lane_metrics: Dict) -> float:
        """Evaluate phase desirability"""
        score = 0
        
        try:
            phase_state = tls.phases[phase_idx].state
            controlled_links = traci.trafficlight.getControlledLinks(tls.tls_id)
            
            for i, (state_char, link_list) in enumerate(zip(phase_state, controlled_links)):
                if state_char in ['G', 'g']:
                    for link in link_list:
                        lane = link[0]
                        if lane in lane_metrics:
                            metrics = lane_metrics[lane]
                            # Demand-based scoring
                            demand_score = (
                                metrics['queue_length'] * 2 +
                                metrics['waiting_time'] * 0.01 +
                                metrics['vehicle_count'] * 0.5
                            )
                            
                            # Fairness bonus
                            time_since_green = self.simulation_step - tls.lane_last_green[lane]
                            fairness_bonus = min(time_since_green / 60, 5)  # Up to 5 points
                            
                            score += demand_score + fairness_bonus
        except:
            pass
        
        return score
    
    def _calculate_reward(self, tls: TargetedTrafficLightManager) -> float:
        """Calculate reward for current state"""
        lane_metrics = tls.get_lane_metrics()
        
        if not lane_metrics:
            return 0
        
        # Aggregate metrics
        total_waiting = sum(m['waiting_time'] for m in lane_metrics.values()) / len(lane_metrics)
        total_queue = sum(m['queue_length'] for m in lane_metrics.values()) / len(lane_metrics)
        total_throughput = sum(m['flow_rate'] for m in lane_metrics.values()) / len(lane_metrics)
        avg_speed = np.mean([m['mean_speed'] for m in lane_metrics.values()])
        
        # Normalized reward components
        waiting_penalty = -min(total_waiting / 180, 1) * 3    # Normalize by 3 minutes
        queue_penalty = -min(total_queue / 20, 1) * 2         # Normalize by 20 vehicles
        throughput_bonus = min(total_throughput / 300, 1) * 2 # Normalize by 300 flow
        speed_bonus = min(avg_speed / 30, 1) * 1              # Normalize by 30 km/h
        
        # Switch penalty (discourage rapid switching)
        switch_penalty = -0.1 if tls.time_since_last_switch < 10 else 0
        
        total_reward = (waiting_penalty + queue_penalty + 
                       throughput_bonus + speed_bonus + switch_penalty)
        
        return total_reward
    
    def _update_all_metrics(self):
        """Update metrics for all TLS"""
        for tls in self.traffic_lights.values():
            # Sync current phase with SUMO's internal state (useful in default control mode)
            try:
                tls.current_phase = traci.trafficlight.getPhase(tls.tls_id)
            except:
                pass
            
            tls.update_fairness_metrics(self.simulation_step)
            tls.time_since_last_switch += self.delta_time
    
    def _handle_emergency_switches(self):
        """Handle emergency switches"""
        for tls in self.traffic_lights.values():
            needs_emergency, emergency_phase = tls.needs_emergency_switch(self.simulation_step)
            if needs_emergency and emergency_phase is not None:
                self._switch_to_phase(tls, emergency_phase)
                self.emergency_switches_total += 1
    
    def _get_observation(self) -> np.ndarray:
        """Get observation with fixed dimensions"""
        obs = np.zeros(607, dtype=np.float32)
        obs_idx = 0
        
        # Process each targeted TLS (even if not initialized)
        for tls_id in self.target_tls_ids:
            if tls_id in self.traffic_lights:
                tls = self.traffic_lights[tls_id]
                
                # TLS state (2 features)
                obs[obs_idx] = tls.current_phase / max(len(tls.phases), 1)
                obs[obs_idx + 1] = min(tls.time_since_last_switch / 100, 1.0)
                obs_idx += 2
                
                # Lane metrics (12 lanes * 7 metrics = 84 features)
                lane_metrics = tls.get_lane_metrics()
                lanes = list(lane_metrics.keys())[:12]
                
                for i in range(12):
                    if i < len(lanes):
                        lane = lanes[i]
                        m = lane_metrics[lane]
                        obs[obs_idx:obs_idx+7] = [
                            m['vehicle_count'] / 30,    # Normalized
                            m['queue_length'] / 20,     # Normalized
                            m['waiting_time'] / 180,    # Normalized
                            m['mean_speed'] / 50,       # Normalized
                            m['occupancy'],             # Already [0,1]
                            m['density'] / 50,          # Normalized
                            m['flow_rate'] / 300        # Normalized
                        ]
                    obs_idx += 7
            else:
                # Fill with zeros for missing TLS
                obs_idx += 86  # 2 + 12*7
        
        # Global metrics (5 features)
        try:
            total_vehicles = min(traci.simulation.getMinExpectedNumber() / 1000, 1)
            progress = min(self.simulation_step / self.num_seconds, 1)
            emergency_rate = min(self.emergency_switches_total / 50, 1)
            
            obs[obs_idx:obs_idx+5] = [
                total_vehicles,
                progress,
                emergency_rate,
                len(self.traffic_lights) / len(self.target_tls_ids),  # Initialization success rate
                0  # Reserved
            ]
        except:
            obs[obs_idx:obs_idx+5] = [0, 0, 0, 0, 0]
        
        return obs
    
    def _get_info(self) -> dict:
        """Get environment info"""
        info = {
            'simulation_step': self.simulation_step,
            'active_tls': len(self.traffic_lights),
            'target_tls': len(self.target_tls_ids),
            'emergency_switches': self.emergency_switches_total,
            'total_vehicles': 0,
            'episode_reward': self.episode_reward
        }
        
        try:
            info['total_vehicles'] = traci.simulation.getMinExpectedNumber()
            
            if self.traffic_lights:
                total_waiting = 0
                total_throughput = 0
                for tls in self.traffic_lights.values():
                    lane_metrics = tls.get_lane_metrics()
                    total_waiting += sum(m['waiting_time'] for m in lane_metrics.values())
                    total_throughput += sum(m['flow_rate'] for m in lane_metrics.values())
                
                info['total_waiting_time'] = total_waiting
                info['total_throughput'] = total_throughput
        except:
            pass
        
        return info
    
    def close(self):
        """Close environment"""
        try:
            if traci.isLoaded():
                traci.close()
        except:
            pass


class FixedTimeController:
    """Fixed-time traffic light controller for baseline comparison"""
    
    def __init__(self, env: AddisTargetedEnvironment, green_time: int = 25, yellow_time: int = 4):
        self.env = env
        self.green_time = green_time
        self.yellow_time = yellow_time
        self.cycle_time = green_time + yellow_time
        
    def run_episode(self) -> Dict[str, float]:
        """Run one episode with fixed-time control"""
        obs, info = self.env.reset()
        
        episode_reward = 0
        total_waiting = 0
        total_throughput = 0
        step_count = 0
        
        while True:
            # Fixed-time logic: switch every cycle_time steps
            actions = []
            for i, tls_id in enumerate(self.env.unwrapped.target_tls_ids):
                if tls_id in self.env.unwrapped.traffic_lights:
                    tls = self.env.unwrapped.traffic_lights[tls_id]
                    # Switch if we've been in current phase for cycle_time
                    should_switch = (tls.time_since_last_switch >= self.cycle_time)
                    actions.append(1 if should_switch else 0)
            
            obs, reward, done, truncated, info = self.env.step(actions)
            episode_reward += reward
            step_count += 1
            
            if 'total_waiting_time' in info:
                total_waiting += info['total_waiting_time']
            if 'total_throughput' in info:
                total_throughput += info['total_throughput']
            
            if done or truncated:
                break
        
        return {
            'episode_reward': episode_reward,
            'total_waiting_time': total_waiting,
            'total_throughput': total_throughput,
            'steps': step_count,
            'avg_waiting_per_step': total_waiting / max(step_count, 1),
            'avg_throughput_per_step': total_throughput / max(step_count, 1)
        }

class SumoDefaultController:
    """Baseline that uses SUMO's default traffic light logic from the net file.
    It does not issue any control actions and simply advances the simulation."""
    def __init__(self, env: AddisTargetedEnvironment):
        self.env = env
    
    def run_episode(self) -> Dict[str, float]:
        obs, info = self.env.reset()
        
        episode_reward = 0
        total_waiting = 0
        total_throughput = 0
        step_count = 0
        
        while True:
            # No actions -> let SUMO's default TL logic run
            obs, reward, done, truncated, info = self.env.step([])
            episode_reward += reward
            step_count += 1
            
            if 'total_waiting_time' in info:
                total_waiting += info['total_waiting_time']
            if 'total_throughput' in info:
                total_throughput += info['total_throughput']
            
            if done or truncated:
                break
        
        return {
            'episode_reward': episode_reward,
            'total_waiting_time': total_waiting,
            'total_throughput': total_throughput,
            'steps': step_count,
            'avg_waiting_per_step': total_waiting / max(step_count, 1),
            'avg_throughput_per_step': total_throughput / max(step_count, 1)
        }
