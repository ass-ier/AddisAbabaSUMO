"""
Addis Ababa Traffic Light RL Environment
==========================================

An efficient traffic light controller using reinforcement learning with:
1. Priority for lanes with most cars
2. Anti-starvation measures to ensure fairness
3. Multi-agent coordination for network-wide optimization
4. Integration with SUMO traffic simulator

Features:
- Automatic traffic light detection
- Intelligent detector placement
- Fairness-aware reward functions
- Anti-starvation constraints
- PPO-compatible interface
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
    """Manages individual traffic lights with fairness constraints"""
    
    def __init__(self, tls_id: str, phases: List, min_green_time: int = 10, 
                 max_red_time: int = 60, yellow_time: int = 4):
        self.tls_id = tls_id
        self.phases = phases
        self.min_green_time = min_green_time
        self.max_red_time = max_red_time
        self.yellow_time = yellow_time
        
        # State tracking
        self.current_phase = 0
        self.time_since_last_switch = 0
        self.phase_start_time = 0
        self.last_action_time = 0
        
        # Fairness tracking
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
                    # Get controlled junctions and their incoming lanes
                    controlled_junctions = traci.trafficlight.getControlledJunctions(self.tls_id)
                    for junction_id in controlled_junctions:
                        junction_lanes = traci.junction.getIncomingLanes(junction_id)
                        for lane in junction_lanes:
                            if lane not in lanes:
                                lanes.append(lane)
                except:
                    pass
            
            print(f"Traffic light {self.tls_id} controls {len(lanes)} lanes: {lanes[:5]}...")  # Show first 5
            return lanes
            
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
        return green_phases if green_phases else list(range(len(self.phases)))
    
    def can_switch_phase(self, current_time: int) -> bool:
        """Check if phase can be switched based on constraints"""
        time_in_phase = current_time - self.phase_start_time
        return time_in_phase >= self.min_green_time
    
    def needs_emergency_switch(self, current_time: int) -> Tuple[bool, Optional[int]]:
        """Check if any lane needs emergency switch due to starvation"""
        current_green_lanes = self._get_current_green_lanes()
        
        for lane in self.controlled_lanes:
            if lane not in current_green_lanes:
                time_since_green = current_time - self.lane_last_green[lane]
                if time_since_green > self.max_red_time:
                    # Find best phase for this starved lane
                    best_phase = self._find_best_phase_for_lane(lane)
                    if best_phase is not None:
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
                        if link[0] not in green_lanes:
                            green_lanes.append(link[0])
            return green_lanes
        except:
            return []
    
    def _find_best_phase_for_lane(self, lane: str) -> Optional[int]:
        """Find the best green phase for a specific lane"""
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
                occupancy = vehicle_count * 5.0 / lane_length if lane_length > 0 else 0  # Assume 5m per vehicle
                
                metrics[lane] = {
                    'vehicle_count': vehicle_count,
                    'queue_length': queue_length,
                    'waiting_time': waiting_time,
                    'mean_speed': mean_speed,
                    'occupancy': occupancy,
                    'density': vehicle_count / (lane_length / 1000) if lane_length > 0 else 0,  # vehicles per km
                    'flow_rate': vehicle_count * mean_speed if mean_speed > 0 else 0
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
    Main traffic light RL environment for Addis Ababa network
    """
    
    metadata = {"render_modes": ["human"], "render_fps": 4}
    
    def __init__(self, 
                 net_file: str,
                 route_file: str,
                 sumocfg_file: Optional[str] = None,
                 use_gui: bool = False,
                 num_seconds: int = 3600,
                 delta_time: int = 5,
                 min_green: int = 10,
                 max_red: int = 60,
                 yellow_time: int = 4,
                 reward_type: str = 'comprehensive'):
        
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
        
        # Initialize RL interface with fallback spaces
        # These will be updated properly during first reset
        self.actual_obs_dim = 0  # Will be set during first reset
        self._setup_fallback_spaces()
        
    def _setup_fallback_spaces(self):
        """Setup fallback action and observation spaces for stable-baselines3 compatibility"""
        # Fallback action space: assume 50 traffic lights, 2 actions each (generous estimate)
        self.action_space = spaces.MultiDiscrete([2] * 50)
        
        # Fallback observation space: generous estimate for large network
        # Assume up to 50 TLS with ~10 lanes each + global metrics
        # Per TLS: 2 features + 10 lanes * 7 metrics = 72 features per TLS
        # Total: 50 * 72 + 5 global = 3605 features (rounded up for safety)
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(3700,), dtype=np.float32
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
            "--no-warnings", "true"
        ])
        
        try:
            traci.start(sumo_cmd)
        except Exception as e:
            print(f"Error starting SUMO: {e}")
            raise
    
    def _detect_traffic_lights(self):
        """Automatically detect and initialize traffic lights"""
        try:
            tls_ids = traci.trafficlight.getIDList()
            print(f"Detected {len(tls_ids)} traffic lights: {tls_ids[:10]}...")  # Show first 10
            
            for tls_id in tls_ids:
                try:
                    programs = traci.trafficlight.getAllProgramLogics(tls_id)
                    if programs:
                        program = programs[0]
                        phases = program.phases
                        
                        # Create traffic light manager
                        self.traffic_lights[tls_id] = TrafficLightManager(
                            tls_id=tls_id,
                            phases=phases,
                            min_green_time=self.min_green,
                            max_red_time=self.max_red,
                            yellow_time=self.yellow_time
                        )
                except Exception as e:
                    print(f"Warning: Could not initialize traffic light {tls_id}: {e}")
            
            print(f"Successfully initialized {len(self.traffic_lights)} traffic lights")
            
        except Exception as e:
            print(f"Error detecting traffic lights: {e}")
            self.traffic_lights = {}
    
    def _setup_action_space(self):
        """Setup action space for all traffic lights"""
        if not self.traffic_lights:
            self.action_space = spaces.Discrete(2)  # Keep, Switch
            return
        
        # Multi-discrete action space: one action per traffic light
        # Action 0: Keep current phase, Action 1: Switch to next phase
        n_lights = len(self.traffic_lights)
        self.action_space = spaces.MultiDiscrete([2] * n_lights)
    
    def _setup_observation_space(self):
        """Setup observation space - only called during reset if not already properly set"""
        if not self.traffic_lights:
            return  # Keep the fallback space
        
        # Calculate actual observation dimensions
        obs_dim = 0
        total_lanes = 0
        
        for tls in self.traffic_lights.values():
            # Per traffic light: current phase + time since switch + lane metrics
            n_lanes = len(tls.controlled_lanes) if tls.controlled_lanes else 0
            total_lanes += n_lanes
            obs_dim += 2 + n_lanes * 7  # 7 metrics per lane
        
        # Global metrics
        obs_dim += 5  # Global metrics
        
        print(f"Actual observation space: {len(self.traffic_lights)} TLS, {total_lanes} lanes, obs_dim={obs_dim}")
        
        # Store the actual observation dimension for padding purposes
        self.actual_obs_dim = obs_dim
        
        # DON'T update observation_space after initialization to maintain stable-baselines3 compatibility
    
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
        self._setup_action_space()
        self._setup_observation_space()
        
        self.simulation_step = 0
        self.episode_reward = 0
        self.total_throughput = 0
        self.total_waiting_time = 0
        self.metrics_history = []
        
        # Initialize traffic light states
        for tls in self.traffic_lights.values():
            tls.phase_start_time = 0
            tls.time_since_last_switch = 0
        
        observation = self._get_observation()
        info = self._get_info()
        
        return observation, info
    
    def step(self, actions):
        """Execute one step in the environment"""
        if not isinstance(actions, (list, np.ndarray)):
            actions = [actions]
        
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
        
        return observation, total_reward, done, False, info
    
    def _execute_action(self, tls: TrafficLightManager, action: int) -> float:
        """Execute action for a specific traffic light"""
        old_phase = tls.current_phase
        reward = 0
        
        # Check for emergency switches first
        needs_emergency, emergency_phase = tls.needs_emergency_switch(self.simulation_step)
        
        if needs_emergency and emergency_phase is not None:
            # Emergency switch to prevent starvation
            if tls.can_switch_phase(self.simulation_step):
                self._switch_to_phase(tls, emergency_phase)
                reward += 10  # Bonus for preventing starvation
        elif action == 1 and tls.can_switch_phase(self.simulation_step):
            # Regular phase switch
            next_phase = self._get_next_optimal_phase(tls)
            if next_phase != tls.current_phase:
                self._switch_to_phase(tls, next_phase)
        
        # Calculate reward based on current state
        reward += self._calculate_reward(tls)
        
        return reward
    
    def _switch_to_phase(self, tls: TrafficLightManager, target_phase: int):
        """Switch traffic light to target phase"""
        try:
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
        
        best_phase = tls.current_phase
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
            phase_state = tls.phases[phase_idx].state
            controlled_links = traci.trafficlight.getControlledLinks(tls.tls_id)
            
            for i, (state_char, link_list) in enumerate(zip(phase_state, controlled_links)):
                if state_char in ['G', 'g']:
                    for link in link_list:
                        lane = link[0]
                        if lane in lane_metrics:
                            metrics = lane_metrics[lane]
                            # Score based on demand and fairness
                            demand_score = (metrics['queue_length'] * 2 + 
                                          metrics['waiting_time'] * 0.1 +
                                          metrics['vehicle_count'])
                            
                            # Fairness bonus for lanes that haven't been green recently
                            time_since_green = self.simulation_step - tls.lane_last_green[lane]
                            fairness_bonus = min(time_since_green / tls.max_red_time * 10, 20)
                            
                            score += demand_score + fairness_bonus
        except Exception as e:
            print(f"Error evaluating phase score: {e}")
        
        return score
    
    def _calculate_reward(self, tls: TrafficLightManager) -> float:
        """Calculate reward for a traffic light's current state"""
        lane_metrics = tls.get_lane_metrics()
        
        if not lane_metrics:
            return 0
        
        # Efficiency metrics
        total_waiting_time = sum(m['waiting_time'] for m in lane_metrics.values())
        total_queue_length = sum(m['queue_length'] for m in lane_metrics.values())
        total_throughput = sum(m['flow_rate'] for m in lane_metrics.values())
        avg_speed = np.mean([m['mean_speed'] for m in lane_metrics.values()])
        
        # Base reward: minimize waiting and queues, maximize throughput
        efficiency_reward = (
            -total_waiting_time * 0.01 +
            -total_queue_length * 0.5 +
            total_throughput * 0.1 +
            avg_speed * 0.05
        )
        
        # Fairness penalty: penalize high variance in waiting times
        waiting_times = [m['waiting_time'] for m in lane_metrics.values()]
        if len(waiting_times) > 1:
            fairness_penalty = -np.var(waiting_times) * 0.001
        else:
            fairness_penalty = 0
        
        # Starvation penalty
        starvation_penalty = 0
        current_green_lanes = tls._get_current_green_lanes()
        for lane in tls.controlled_lanes:
            if lane not in current_green_lanes:
                time_since_green = self.simulation_step - tls.lane_last_green[lane]
                if time_since_green > tls.max_red_time * 0.8:  # 80% of max red time
                    starvation_penalty -= 5
        
        # Phase switching penalty (to avoid excessive switching)
        switch_penalty = -0.1 if tls.time_since_last_switch < tls.min_green_time else 0
        
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
                print(f"Emergency switch for {tls.tls_id} to phase {emergency_phase}")
                self._switch_to_phase(tls, emergency_phase)
    
    def _get_observation(self) -> np.ndarray:
        """Get current observation state"""
        # Handle case when environment hasn't been properly reset yet
        if not self.traffic_lights:
            # Return zero observation matching the current observation space
            return np.zeros(self.observation_space.shape, dtype=np.float32)
        
        obs = []
        
        for tls_id, tls in self.traffic_lights.items():
            # Traffic light state
            obs.extend([
                tls.current_phase / len(tls.phases) if tls.phases else 0,
                min(tls.time_since_last_switch / 100, 1.0)  # Normalized time since switch
            ])
            
            # Lane metrics
            lane_metrics = tls.get_lane_metrics()
            for lane in tls.controlled_lanes:
                if lane in lane_metrics:
                    metrics = lane_metrics[lane]
                    obs.extend([
                        min(metrics['vehicle_count'] / 20, 1.0),  # Normalized
                        min(metrics['queue_length'] / 10, 1.0),
                        min(metrics['waiting_time'] / 300, 1.0),
                        min(metrics['mean_speed'] / 15, 1.0),
                        min(metrics['occupancy'], 1.0),
                        min(metrics['density'] / 100, 1.0),
                        min(metrics['flow_rate'] / 50, 1.0)
                    ])
                else:
                    obs.extend([0.0] * 7)
        
        # Global metrics
        try:
            total_vehicles = traci.simulation.getDepartedNumber()
            total_arrived = traci.simulation.getArrivedNumber()
            avg_travel_time = traci.simulation.getCollisions()  # Placeholder
            
            obs.extend([
                min(total_vehicles / 1000, 1.0),
                min(total_arrived / 1000, 1.0),
                min(self.simulation_step / self.num_seconds, 1.0),
                min(len(self.traffic_lights) / 100, 1.0),
                0.0  # Placeholder for additional global metric
            ])
        except:
            obs.extend([0.0] * 5)
        
        # Ensure observation matches expected dimension (fallback space)
        expected_dim = self.observation_space.shape[0]
        if len(obs) < expected_dim:
            # Pad with zeros
            obs.extend([0.0] * (expected_dim - len(obs)))
        elif len(obs) > expected_dim:
            # Truncate (should not happen with our generous fallback)
            obs = obs[:expected_dim]
        
        return np.array(obs, dtype=np.float32)
    
    def _get_info(self) -> Dict:
        """Get info dictionary for logging and analysis"""
        info = {
            'simulation_step': self.simulation_step,
            'episode_reward': self.episode_reward,
            'num_traffic_lights': len(self.traffic_lights),
            'total_vehicles': 0,
            'total_waiting_time': 0,
            'avg_speed': 0
        }
        
        try:
            info['total_vehicles'] = traci.simulation.getDepartedNumber()
            info['total_arrived'] = traci.simulation.getArrivedNumber()
            
            # Calculate aggregated metrics
            total_waiting = 0
            total_speed = 0
            lane_count = 0
            
            for tls in self.traffic_lights.values():
                lane_metrics = tls.get_lane_metrics()
                for metrics in lane_metrics.values():
                    total_waiting += metrics['waiting_time']
                    total_speed += metrics['mean_speed']
                    lane_count += 1
            
            info['total_waiting_time'] = total_waiting
            info['avg_speed'] = total_speed / lane_count if lane_count > 0 else 0
            
        except Exception as e:
            print(f"Error calculating info metrics: {e}")
        
        return info
    
    def close(self):
        """Close the environment"""
        try:
            if traci.isLoaded():
                traci.close()
        except:
            pass
    
    def render(self, mode='human'):
        """Render the environment (SUMO GUI handles this)"""
        pass


if __name__ == "__main__":
    # Test the environment
    env = AddisTrafficEnvironment(
        net_file="AddisAbaba.net.xml",
        route_file="addisTrafficFullNetwork.rou.xml",
        sumocfg_file="AddisAbabaSimple.sumocfg",
        use_gui=True,
        num_seconds=1000
    )
    
    try:
        obs = env.reset()
        print(f"Observation shape: {obs.shape}")
        print(f"Action space: {env.action_space}")
        
        for i in range(10):
            actions = env.action_space.sample()
            obs, reward, done, truncated, info = env.step(actions)
            print(f"Step {i}: reward={reward:.3f}, done={done}, info={info}")
            
            if done:
                break
    
    finally:
        env.close()