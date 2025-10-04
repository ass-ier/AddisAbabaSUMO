"""
Custom reward function for SUMO-RL that combines multiple objectives with fairness metrics.

This module provides fairness_combined_reward function that balances congestion reduction,
throughput maximization, and fairness considerations for multi-agent traffic control.
"""

import sys
import os

# Add sumo-rl to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'sumo-rl'))
from sumo_rl.environment.traffic_signal import TrafficSignal


def fairness_combined_reward(ts: TrafficSignal) -> float:
    """
    Compute multi-objective reward balancing congestion, throughput, and fairness.
    
    Combines queue efficiency, wait time efficiency, throughput, fairness score,
    stagnation penalty, and yellow phase penalty with configurable weights.
    
    Args:
        ts: TrafficSignal instance from SUMO-RL
        
    Returns:
        float: Combined reward value
    """
    # Queue efficiency component
    total_queue = ts.get_total_queued()
    total_lanes = len(ts.lanes)
    max_possible_queue = total_lanes * 20  # Assume 20 vehicles per lane capacity
    queue_efficiency = max(0, (max_possible_queue - total_queue) / max(max_possible_queue, 1))
    
    # Wait time efficiency component
    wait_times = ts.get_accumulated_waiting_time_per_lane()
    total_wait = sum(wait_times)
    wait_efficiency = max(0, 1.0 / (1.0 + total_wait / max(total_lanes * 100, 1)))
    
    # Throughput component
    departed = ts.sumo.simulation.getDepartedNumber()
    throughput_reward = min(1.0, departed / max(total_lanes * 2, 1))
    
    # Fairness component (requires accessing observation function state)
    fairness_score = 1.0
    if hasattr(ts.observation_fn, 'phase_usage') and ts.observation_fn.step_count > 100:
        phase_usage = ts.observation_fn.phase_usage
        total_usage = sum(phase_usage.values())
        
        if total_usage > 0:
            # Normalize usage
            usage_values = [phase_usage.get(i, 0) / total_usage for i in range(ts.num_green_phases)]
            # Compute expected uniform usage
            expected_usage = 1.0 / ts.num_green_phases
            # Compute variance
            variance = sum((u - expected_usage)**2 for u in usage_values) / ts.num_green_phases
            # Compute fairness score
            fairness_score = max(0, 1.0 - variance * 10)
    
    # Stagnation penalty component
    stagnation_penalty = 1.0
    if hasattr(ts.observation_fn, 'same_phase_count'):
        stagnation_penalty = max(0, 1.0 - (ts.observation_fn.same_phase_count / 100.0))
    
    # Yellow phase penalty
    yellow_penalty = -0.1 if ts.is_yellow else 0
    
    # Combine with weights (matching traffic_env_single_tls.py)
    w_queue = 0.30
    w_wait = 0.25
    w_throughput = 0.20
    w_fairness = 0.15
    w_stagnation = 0.05
    w_yellow = 0.05
    
    reward = (w_queue * queue_efficiency + 
              w_wait * wait_efficiency + 
              w_throughput * throughput_reward + 
              w_fairness * fairness_score + 
              w_stagnation * stagnation_penalty + 
              w_yellow * yellow_penalty)
    
    return float(reward)


# Register the reward function with SUMO-RL
TrafficSignal.register_reward_fn(fairness_combined_reward)
