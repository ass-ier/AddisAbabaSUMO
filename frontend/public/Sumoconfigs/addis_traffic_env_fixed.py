"""
Addis Ababa Traffic Light RL Environment - FIXED VERSION
=======================================================

An efficient traffic light controller using reinforcement learning with:
1. Reduced scope for better training (subset of traffic lights)
2. Relaxed emergency constraints
3. Better RL agent coordination
4. Improved reward functions

Key fixes:
- Limited to most important traffic lights only
- Increased max_red_time to prevent constant emergency switches
- Better phase transition logic
- Improved observation normalization
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

class TrafficLightManager:
    """Manages individual traffic lights with improved fairness constraints"""
    
    def __init__(self, tls_id: str, phases: List, min_green_time: int = 15, 
                 max_red_time: int = 120, yellow_time: int = 4):  # Increased constraints
        self.tls_id = tls_id
        self.phases = phases
        self.min_green_time = min_green_time
        self.max_red_time = max_red_time  # Doubled from 60 to 120
        self.yellow_time = yellow_time
        
        # State tracking
        self.current_phase = 0
        self.time_since_last_switch = 0
        self.phase_start_time = 0
        self.last_action_time = 0
        
        # Fairness tracking - with longer patience
        self.lane_last_green = defaultdict(lambda: -max_red_time)
        self.lane_total_waiting_time = defaultdict(float)
        self.lane_max_waiting_time = defaultdict(float)
        
        # Performance metrics
        self.total_throughput = 0
        self.total_waiting_time = 0
        self.phase_switches = 0
        
        # Get controlled lanes
        self.controlled_lanes = self._get_controlled_lanes()
        self.green_phases = self._identify_green_phases()
        
        # Emergency switch cooldown to prevent rapid switching
        self.last_emergency_switch = -120
        self.emergency_cooldown = 30  # Minimum time between emergency switches
        
    def _get_controlled_lanes(self) -> List[str]:
        """Get all lanes controlled by this traffic light"""
        try:
            controlled_links = traci.trafficlight.getControlledLinks(self.tls_id)
            lanes = []
            for link_list in controlled_links:
                for link in link_list:
                    if link[0] and link[0] not in lanes:  # incoming lane
                        lanes.append(link[0])
            
            # If no lanes found through links, try alternative approach
            if not lanes:
                try:
                    controlled_junctions = traci.trafficlight.getControlledJunctions(self.tls_id)
                    for junction_id in controlled_junctions:
                        junction_lanes = traci.junction.getIncomingLanes(junction_id)
                        for lane in junction_lanes:
                            if lane not in lanes:
                                lanes.append(lane)
                except:
                    pass
            
            return lanes[:10]  # Limit to first 10 lanes to manage complexity
            
        except Exception as e:
            print(f"Warning: Could not get controlled lanes for {self.tls_id}: {e}")
            return []
    
    def _identify_green_phases(self) -> List[int]:
        """Identify which phases are green (non-yellow, non-red)"""
        green_phases = []
        for i, phase in enumerate(self.phases):
            # A phase is considered green if it has 'G' or 'g' states
            if 'G' in phase.state or 'g' in phase.state:
                green_phases.append(i)
        return green_phases if green_phases else list(range(min(len(self.phases), 4)))  # Limit phases
    
    def can_switch_phase(self, current_time: int) -> bool:
        """Check if phase can be switched based on constraints"""
        time_in_phase = current_time - self.phase_start_time
        return time_in_phase >= self.min_green_time
    
    def needs_emergency_switch(self, current_time: int) -> Tuple[bool, Optional[int]]:
        """Check if any lane needs emergency switch due to starvation - WITH COOLDOWN"""
        # Check cooldown first
        if current_time - self.last_emergency_switch < self.emergency_cooldown:
            return False, None
            
        current_green_lanes = self._get_current_green_lanes()
        
        # Only trigger emergency if SEVERELY starved (90% of max red time)
        emergency_threshold = self.max_red_time * 0.9
        
        most_starved_lane = None
        max_starvation_time = 0
        
        for lane in self.controlled_lanes:
            if lane not in current_green_lanes:
                time_since_green = current_time - self.lane_last_green[lane]
                if time_since_green > emergency_threshold and time_since_green > max_starvation_time:
                    max_starvation_time = time_since_green
                    most_starved_lane = lane
        
        if most_starved_lane:
            # Find best phase for the most starved lane
            best_phase = self._find_best_phase_for_lane(most_starved_lane)
            if best_phase is not None and best_phase != self.current_phase:
                self.last_emergency_switch = current_time
                return True, best_phase
        
        return False, None
    
    def _get_current_green_lanes(self) -> List[str]:
        """Get lanes that are currently green"""
        try:
            current_state = traci.trafficlight.getRedYellowGreenState(self.tls_id)
            controlled_links = traci.trafficlight.getControlledLinks(self.tls_id)
            
            green_lanes = []
            for i, (state_char, link_list) in enumerate(zip(current_state, controlled_links)):
                if state_char in ['G', 'g']:
                    for link in link_list:
                        if link[0] and link[0] not in green_lanes:
                            green_lanes.append(link[0])
            return green_lanes
        except:
            return []
    
    def _find_best_phase_for_lane(self, lane: str) -> Optional[int]:
        """Find the best green phase for a specific lane"""
        try:
            controlled_links = traci.trafficlight.getControlledLinks(self.tls_id)
            
            for phase_idx in self.green_phases:
                if phase_idx < len(self.phases):
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
        """Get comprehensive metrics for each controlled lane"""
        metrics = {}
        
        for lane in self.controlled_lanes:
            try:
                # Basic traffic metrics
                vehicle_count = traci.lane.getLastStepVehicleNumber(lane)
                queue_length = traci.lane.getLastStepHaltingNumber(lane)
                mean_speed = traci.lane.getLastStepMeanSpeed(lane)
                waiting_time = traci.lane.getWaitingTime(lane)
                
                # Calculate occupancy and density
                lane_length = traci.lane.getLength(lane)
                occupancy = min(vehicle_count * 5.0 / max(lane_length, 1), 1.0)  # Normalized
                
                metrics[lane] = {
                    'vehicle_count': min(vehicle_count, 50),  # Cap at 50 for normalization
                    'queue_length': min(queue_length, 30),   # Cap at 30
                    'waiting_time': min(waiting_time, 300),  # Cap at 5 minutes
                    'mean_speed': mean_speed,
                    'occupancy': occupancy,
                    'density': min(vehicle_count / max(lane_length / 1000, 0.1), 100),  # Cap density
                    'flow_rate': min(vehicle_count * mean_speed, 500) if mean_speed > 0 else 0  # Cap flow
                }
            except:
                metrics[lane] = {
                    'vehicle_count': 0, 'queue_length': 0, 'waiting_time': 0,
                    'mean_speed': 0, 'occupancy': 0, 'density': 0, 'flow_rate': 0
                }
        
        return metrics
    
    def update_fairness_metrics(self, current_time: int):
        """Update fairness tracking metrics"""
        current_green_lanes = self._get_current_green_lanes()
        
        for lane in self.controlled_lanes:
            if lane in current_green_lanes:
                self.lane_last_green[lane] = current_time
            
            # Update waiting time metrics
            try:
                waiting_time = traci.lane.getWaitingTime(lane)
                self.lane_total_waiting_time[lane] += waiting_time
                self.lane_max_waiting_time[lane] = max(self.lane_max_waiting_time[lane], waiting_time)
            except:
                pass


class AddisTrafficEnvironment(gym.Env):
    """
    FIXED Main traffic light RL environment for Addis Ababa network
    """
    
    metadata = {"render_modes": ["human"], "render_fps": 4}
    
    def __init__(self, 
                 net_file: str,
                 route_file: str,
                 sumocfg_file: Optional[str] = None,
                 use_gui: bool = False,
                 num_seconds: int = 3600,
                 delta_time: int = 5,
                 min_green: int = 15,      # Increased from 10
                 max_red: int = 120,       # Increased from 60
                 yellow_time: int = 4,
                 reward_type: str = 'comprehensive',
                 max_traffic_lights: int = 10):  # NEW: Limit number of TLS
        
        self.net_file = net_file
        self.route_file = route_file
        self.sumocfg_file = sumocfg_file
        self.use_gui = use_gui
        self.num_seconds = num_seconds
        self.delta_time = delta_time
        self.min_green = min_green
        self.max_red = max_red
        self.yellow_time = yellow_time
        self.reward_type = reward_type
        self.max_traffic_lights = max_traffic_lights  # NEW: Limit complexity
        
        # Environment state
        self.simulation_step = 0
        self.traffic_lights = {}
        self.metrics_history = []
        self.episode_metrics = defaultdict(list)
        
        # Performance tracking
        self.baseline_metrics = None
        self.episode_reward = 0
        self.total_throughput = 0
        self.total_waiting_time = 0
        
        # Emergency switch tracking
        self.emergency_switches_count = 0
        
        # Initialize RL interface with reasonable fixed spaces
        self._setup_fixed_spaces()
        
    def _setup_fixed_spaces(self):
        """Setup fixed action and observation spaces for stable-baselines3 compatibility"""
        # Action space: limited number of traffic lights, 2 actions each (keep/switch)
        self.action_space = spaces.MultiDiscrete([2] * self.max_traffic_lights)
        
        # Observation space: fixed size for stability
        # Per TLS: 2 features + up to 10 lanes * 7 metrics = 72 features per TLS
        # Total: max_traffic_lights * 72 + 10 global metrics
        obs_dim = self.max_traffic_lights * 72 + 10
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(obs_dim,), dtype=np.float32
        )
        
    def _start_sumo(self):
        """Start SUMO simulation"""
        sumo_cmd = []
        
        if self.use_gui:
            sumo_cmd = ["sumo-gui"]
        else:
            sumo_cmd = ["sumo"]
        
        if self.sumocfg_file:
            sumo_cmd.extend(["-c", self.sumocfg_file])
        else:
            sumo_cmd.extend([
                "-n", self.net_file,
                "-r", self.route_file,
            ])
        
        sumo_cmd.extend([
            "--waiting-time-memory", "10000",
            "--time-to-teleport", "600",
            "--no-step-log", "true",
            "--no-warnings", "true",
            "--duration-log.disable", "true"  # Reduce log noise
        ])
        
        try:
            traci.start(sumo_cmd)
        except Exception as e:
            print(f"Error starting SUMO: {e}")
            raise
    
    def _detect_traffic_lights(self):
        """Detect and initialize LIMITED set of most important traffic lights"""
        try:
            all_tls_ids = traci.trafficlight.getIDList()
            print(f"Detected {len(all_tls_ids)} total traffic lights")
            
            # Filter to get most important intersections (avoid clusters and complex names)
            important_tls = []
            
            # Prioritize simple intersection names (likely main junctions)
            for tls_id in all_tls_ids:
                # Skip overly complex clustered intersections
                if len(tls_id) < 50 and 'cluster' not in tls_id.lower():
                    important_tls.append(tls_id)
                
                # Stop when we have enough
                if len(important_tls) >= self.max_traffic_lights:
                    break
            
            # If we don't have enough simple ones, take the first few complex ones
            if len(important_tls) < self.max_traffic_lights:
                for tls_id in all_tls_ids:
                    if tls_id not in important_tls:
                        important_tls.append(tls_id)
                        if len(important_tls) >= self.max_traffic_lights:
                            break
            
            print(f"Selected {len(important_tls)} traffic lights for RL control:")
            for i, tls_id in enumerate(important_tls):
                print(f"  {i+1:2d}. {tls_id}")
            
            # Initialize selected traffic lights
            for tls_id in important_tls:
                try:
                    programs = traci.trafficlight.getAllProgramLogics(tls_id)
                    if programs:
                        program = programs[0]
                        phases = program.phases[:8]  # Limit to 8 phases max
                        
                        # Create traffic light manager with relaxed constraints
                        self.traffic_lights[tls_id] = TrafficLightManager(
                            tls_id=tls_id,
                            phases=phases,
                            min_green_time=self.min_green,
                            max_red_time=self.max_red,
                            yellow_time=self.yellow_time
                        )
                        
                        print(f"✓ Initialized {tls_id} with {len(phases)} phases, {len(self.traffic_lights[tls_id].controlled_lanes)} lanes")
                        
                except Exception as e:
                    print(f"Warning: Could not initialize traffic light {tls_id}: {e}")
            
            print(f"Successfully initialized {len(self.traffic_lights)} traffic lights for RL control")
            
        except Exception as e:
            print(f"Error detecting traffic lights: {e}")
            self.traffic_lights = {}
    
    def reset(self, seed=None, options=None):
        """Reset the environment"""
        super().reset(seed=seed)
        
        try:
            if traci.isLoaded():
                traci.close()
        except:
            pass
        
        self._start_sumo()
        
        # Take a few simulation steps to ensure SUMO is fully loaded
        for _ in range(5):
            traci.simulationStep()
            
        self._detect_traffic_lights()
        
        self.simulation_step = 0
        self.episode_reward = 0
        self.total_throughput = 0
        self.total_waiting_time = 0
        self.metrics_history = []
        self.emergency_switches_count = 0
        
        # Initialize traffic light states
        for tls in self.traffic_lights.values():
            tls.phase_start_time = 0
            tls.time_since_last_switch = 0
            tls.last_emergency_switch = -120
        
        observation = self._get_observation()
        info = self._get_info()
        
        return observation, info
    
    def step(self, actions):
        """Execute one step in the environment"""
        if not isinstance(actions, (list, np.ndarray)):
            actions = [actions]
        
        # Ensure actions match number of controlled traffic lights
        actions = actions[:len(self.traffic_lights)]
        
        # Execute actions for each traffic light
        rewards = []
        tls_list = list(self.traffic_lights.keys())
        
        for i, (tls_id, action) in enumerate(zip(tls_list, actions)):
            if tls_id not in self.traffic_lights:
                continue
                
            tls = self.traffic_lights[tls_id]
            reward = self._execute_action(tls, action)
            rewards.append(reward)
        
        # Advance simulation
        for _ in range(self.delta_time):
            traci.simulationStep()
            self.simulation_step += 1
        
        # Update metrics and check for emergency switches
        self._update_all_metrics()
        self._check_emergency_switches()
        
        observation = self._get_observation()
        total_reward = np.mean(rewards) if rewards else 0
        self.episode_reward += total_reward
        
        # Check if episode is done
        done = (self.simulation_step >= self.num_seconds or 
                traci.simulation.getMinExpectedNumber() <= 0)
        
        info = self._get_info()
        info['emergency_switches'] = self.emergency_switches_count
        
        return observation, total_reward, done, False, info
    
    def _execute_action(self, tls: TrafficLightManager, action: int) -> float:
        """Execute action for a specific traffic light"""
        reward = 0
        
        # Check for emergency switches first (with reduced frequency)
        needs_emergency, emergency_phase = tls.needs_emergency_switch(self.simulation_step)
        
        if needs_emergency and emergency_phase is not None:
            # Emergency switch to prevent severe starvation
            if tls.can_switch_phase(self.simulation_step):
                self._switch_to_phase(tls, emergency_phase)
                reward += 5  # Smaller bonus to discourage reliance on emergency switches
                print(f"Emergency switch for {tls.tls_id} to phase {emergency_phase}")
        elif action == 1 and tls.can_switch_phase(self.simulation_step):
            # Regular RL-controlled phase switch
            next_phase = self._get_next_optimal_phase(tls)
            if next_phase != tls.current_phase:
                self._switch_to_phase(tls, next_phase)
                reward += 1  # Small bonus for taking action
        
        # Calculate reward based on current state
        reward += self._calculate_reward(tls)
        
        return reward
    
    def _switch_to_phase(self, tls: TrafficLightManager, target_phase: int):
        """Switch traffic light to target phase"""
        try:
            # Ensure target phase is valid
            if target_phase >= len(tls.phases):
                target_phase = target_phase % len(tls.phases)
                
            traci.trafficlight.setPhase(tls.tls_id, target_phase)
            tls.current_phase = target_phase
            tls.phase_start_time = self.simulation_step
            tls.time_since_last_switch = 0
            tls.phase_switches += 1
        except Exception as e:
            print(f"Error switching phase for {tls.tls_id}: {e}")
    
    def _get_next_optimal_phase(self, tls: TrafficLightManager) -> int:
        """Get the optimal next phase based on traffic demand"""
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
    
    def _evaluate_phase_score(self, tls: TrafficLightManager, phase_idx: int, 
                             lane_metrics: Dict) -> float:
        """Evaluate the desirability of a phase based on current traffic"""
        score = 0
        
        try:
            if phase_idx >= len(tls.phases):
                return -float('inf')
                
            phase_state = tls.phases[phase_idx].state
            controlled_links = traci.trafficlight.getControlledLinks(tls.tls_id)
            
            for i, (state_char, link_list) in enumerate(zip(phase_state, controlled_links)):
                if state_char in ['G', 'g'] and i < len(controlled_links):
                    for link in link_list:
                        lane = link[0]
                        if lane in lane_metrics:
                            metrics = lane_metrics[lane]
                            # Score based on demand and fairness
                            demand_score = (metrics['queue_length'] * 3 + 
                                          metrics['waiting_time'] * 0.01 +
                                          metrics['vehicle_count'] * 0.5)
                            
                            # Fairness bonus for lanes that haven't been green recently
                            time_since_green = self.simulation_step - tls.lane_last_green[lane]
                            fairness_bonus = min(time_since_green / tls.max_red_time * 5, 10)
                            
                            score += demand_score + fairness_bonus
        except Exception as e:
            # Silently handle errors to reduce log noise
            pass
        
        return score
    
    def _calculate_reward(self, tls: TrafficLightManager) -> float:
        """Calculate reward for a traffic light's current state"""
        lane_metrics = tls.get_lane_metrics()
        
        if not lane_metrics:
            return 0
        
        # Efficiency metrics (normalized)
        total_waiting_time = sum(m['waiting_time'] for m in lane_metrics.values()) / max(len(lane_metrics), 1)
        total_queue_length = sum(m['queue_length'] for m in lane_metrics.values()) / max(len(lane_metrics), 1)
        total_throughput = sum(m['flow_rate'] for m in lane_metrics.values()) / max(len(lane_metrics), 1)
        avg_speed = np.mean([m['mean_speed'] for m in lane_metrics.values()])
        
        # Normalize metrics to [0,1] range
        waiting_norm = min(total_waiting_time / 300, 1)  # Normalize by 5 minutes
        queue_norm = min(total_queue_length / 30, 1)     # Normalize by 30 vehicles
        throughput_norm = min(total_throughput / 500, 1) # Normalize by 500 flow rate
        speed_norm = min(avg_speed / 50, 1)              # Normalize by 50 km/h
        
        # Base reward: minimize waiting and queues, maximize throughput and speed
        efficiency_reward = (
            -waiting_norm * 2 +
            -queue_norm * 3 +
            throughput_norm * 2 +
            speed_norm * 1
        )
        
        # Fairness penalty: penalize high variance in waiting times (reduced impact)
        waiting_times = [m['waiting_time'] for m in lane_metrics.values()]
        if len(waiting_times) > 1:
            fairness_penalty = -min(np.var(waiting_times) / 10000, 1)  # Normalized variance penalty
        else:
            fairness_penalty = 0
        
        # Reduced starvation penalty (let emergency switches handle severe cases)
        starvation_penalty = 0
        current_green_lanes = tls._get_current_green_lanes()
        for lane in tls.controlled_lanes:
            if lane not in current_green_lanes:
                time_since_green = self.simulation_step - tls.lane_last_green[lane]
                if time_since_green > tls.max_red_time * 0.7:  # 70% of max red time
                    starvation_penalty -= 1  # Reduced penalty
        
        # Reduced phase switching penalty
        switch_penalty = -0.05 if tls.time_since_last_switch < tls.min_green_time else 0
        
        total_reward = (efficiency_reward + fairness_penalty + 
                       starvation_penalty + switch_penalty)
        
        return total_reward
    
    def _update_all_metrics(self):
        """Update metrics for all traffic lights"""
        for tls in self.traffic_lights.values():
            tls.update_fairness_metrics(self.simulation_step)
            tls.time_since_last_switch += self.delta_time
    
    def _check_emergency_switches(self):
        """Check for and handle emergency switches due to starvation"""
        for tls in self.traffic_lights.values():
            needs_emergency, emergency_phase = tls.needs_emergency_switch(self.simulation_step)
            if needs_emergency and emergency_phase is not None:
                self._switch_to_phase(tls, emergency_phase)
                self.emergency_switches_count += 1
                # Reduced logging to prevent spam
                if self.emergency_switches_count % 10 == 1:  # Log every 10th emergency switch
                    print(f"Emergency switches so far: {self.emergency_switches_count}")
    
    def _get_observation(self) -> np.ndarray:
        """Get current observation state with fixed dimensions"""
        # Always return observation matching the fixed observation space
        full_obs = np.zeros(self.observation_space.shape[0], dtype=np.float32)
        
        if not self.traffic_lights:
            return full_obs
        
        obs_idx = 0
        tls_list = list(self.traffic_lights.keys())[:self.max_traffic_lights]
        
        for i in range(self.max_traffic_lights):
            if i < len(tls_list):
                tls_id = tls_list[i]
                tls = self.traffic_lights[tls_id]
                
                # Traffic light state (2 features)
                full_obs[obs_idx] = tls.current_phase / max(len(tls.phases), 1)
                full_obs[obs_idx + 1] = min(tls.time_since_last_switch / 100, 1.0)
                obs_idx += 2
                
                # Lane metrics (up to 10 lanes * 7 metrics = 70 features)
                lane_metrics = tls.get_lane_metrics()
                lane_list = list(lane_metrics.keys())[:10]  # Max 10 lanes
                
                for j in range(10):  # Always 10 lane slots
                    if j < len(lane_list):
                        lane = lane_list[j]
                        metrics = lane_metrics[lane]
                        # Normalize all metrics to [0,1]
                        full_obs[obs_idx:obs_idx+7] = [
                            metrics['vehicle_count'] / 50,      # Normalized by max 50
                            metrics['queue_length'] / 30,       # Normalized by max 30
                            metrics['waiting_time'] / 300,      # Normalized by 5 minutes
                            metrics['mean_speed'] / 50,         # Normalized by 50 km/h
                            metrics['occupancy'],               # Already [0,1]
                            metrics['density'] / 100,           # Normalized by max 100
                            metrics['flow_rate'] / 500          # Normalized by max 500
                        ]
                    obs_idx += 7
            else:
                # Fill empty TLS slots with zeros
                obs_idx += 72  # 2 + 10*7
        
        # Global metrics (10 features)
        try:
            total_vehicles = traci.simulation.getMinExpectedNumber()
            total_waiting = sum(traci.lane.getWaitingTime(lane) 
                              for tls in self.traffic_lights.values() 
                              for lane in tls.controlled_lanes)
            avg_speed = np.mean([traci.lane.getLastStepMeanSpeed(lane) 
                               for tls in self.traffic_lights.values() 
                               for lane in tls.controlled_lanes])
            
            full_obs[obs_idx:obs_idx+10] = [
                min(total_vehicles / 1000, 1),           # Normalized total vehicles
                min(total_waiting / 10000, 1),           # Normalized total waiting
                min(avg_speed / 50, 1) if not np.isnan(avg_speed) else 0,  # Normalized avg speed
                min(self.simulation_step / self.num_seconds, 1),  # Progress
                min(len(self.traffic_lights) / self.max_traffic_lights, 1), # TLS utilization
                min(self.emergency_switches_count / 100, 1),      # Emergency switches
                0, 0, 0, 0  # Reserved for future metrics
            ]
        except:
            # If error, fill with safe defaults
            full_obs[obs_idx:obs_idx+10] = [0] * 10
        
        return full_obs
    
    def _get_info(self) -> dict:
        """Get environment info"""
        info = {
            'simulation_step': self.simulation_step,
            'num_traffic_lights': len(self.traffic_lights),
            'total_vehicles': 0,
            'total_waiting_time': 0,
            'avg_speed': 0,
            'emergency_switches': self.emergency_switches_count
        }
        
        try:
            info['total_vehicles'] = traci.simulation.getMinExpectedNumber()
            
            if self.traffic_lights:
                all_lanes = [lane for tls in self.traffic_lights.values() for lane in tls.controlled_lanes]
                if all_lanes:
                    waiting_times = [traci.lane.getWaitingTime(lane) for lane in all_lanes]
                    speeds = [traci.lane.getLastStepMeanSpeed(lane) for lane in all_lanes]
                    
                    info['total_waiting_time'] = sum(waiting_times)
                    info['avg_speed'] = np.mean([s for s in speeds if s > 0]) if speeds else 0
        except:
            pass
        
        return info
    
    def close(self):
        """Close the environment"""
        try:
            if traci.isLoaded():
                traci.close()
        except:
            pass
    
    def render(self):
        """Render the environment (handled by SUMO GUI if enabled)"""
        pass