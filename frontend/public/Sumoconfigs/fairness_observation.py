"""
Custom observation function for SUMO-RL that extends default observations with fairness tracking.

This module provides FairnessObservationFunction that tracks phase usage, stagnation,
and provides fairness-aware observations for multi-agent traffic light control.
"""

import numpy as np
import sys
import os
from gymnasium import spaces

# Add sumo-rl to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'sumo-rl'))
from sumo_rl.environment.observations import ObservationFunction


class FairnessObservationFunction(ObservationFunction):
    """
    Custom observation function that extends default SUMO-RL observations with fairness metrics.
    
    Tracks phase usage distribution and stagnation to provide fairness-aware observations
    for multi-agent traffic light control.
    """
    
    def __init__(self, ts):
        """
        Initialize fairness observation function.
        
        Args:
            ts: TrafficSignal instance from SUMO-RL
        """
        super().__init__(ts)
        
        # Initialize per-agent tracking dictionaries
        # Handle case where num_green_phases might not be available yet
        try:
            num_phases = getattr(ts, 'num_green_phases', 4)  # Default to 4 if not available
            self.phase_usage = {i: 0 for i in range(num_phases)}
        except (AttributeError, TypeError):
            # Fallback if num_green_phases is not accessible
            self.phase_usage = {i: 0 for i in range(4)}  # Default to 4 phases
        
        self.last_action = None
        self.same_phase_count = 0
        self.step_count = 0
    
    def __call__(self):
        """
        Compute observation vector with fairness components.
        
        Returns:
            np.ndarray: Observation vector containing:
                - Phase one-hot encoding
                - Min green flag
                - Lane density
                - Lane queue
                - Phase usage distribution (normalized)
                - Stagnation indicator
        """
        # Track phase usage and stagnation mirroring single TLS env counters
        current_phase = self.ts.green_phase

        # Ensure key exists and increment usage for the active phase every step
        if current_phase not in self.phase_usage:
            self.phase_usage[current_phase] = 0
        self.phase_usage[current_phase] += 1

        # Update consecutive same phase counter
        if self.last_action is None:
            # First call initialization
            self.last_action = current_phase
        elif current_phase == self.last_action:
            self.same_phase_count += 1
        else:
            self.same_phase_count = 0
            self.last_action = current_phase

        self.step_count += 1
        
        # Get the actual number of green phases, with fallback
        try:
            num_phases = getattr(self.ts, 'num_green_phases', len(self.phase_usage))
        except (AttributeError, TypeError):
            num_phases = len(self.phase_usage)
        
        # Get default observation components
        # Create phase one-hot encoding manually
        phase_id = [1 if self.ts.green_phase == i else 0 for i in range(num_phases)]
        min_green = [self.ts.time_since_last_phase_change >= self.ts.min_green]
        density = self.ts.get_lanes_density()
        queue = self.ts.get_lanes_queue()
        
        # Compute fairness features
        
        total_usage = sum(self.phase_usage.values())
        if total_usage > 0:
            phase_usage_normalized = [self.phase_usage.get(i, 0) / total_usage 
                                    for i in range(num_phases)]
        else:
            phase_usage_normalized = [0.0] * num_phases
        
        # Stagnation indicator (normalized, capped at 1.0)
        stagnation_indicator = [min(1.0, self.same_phase_count / 100.0)]
        
        # Concatenate all components
        observation = np.concatenate([
            phase_id,
            min_green,
            density,
            queue,
            phase_usage_normalized,
            stagnation_indicator
        ]).astype(np.float32)
        
        return observation
    
    def observation_space(self):
        """
        Define observation space dimensions.
        
        Returns:
            spaces.Box: Observation space with appropriate bounds
        """
        # Get the actual number of green phases, with fallback
        try:
            num_phases = getattr(self.ts, 'num_green_phases', len(self.phase_usage))
        except (AttributeError, TypeError):
            num_phases = len(self.phase_usage)
        
        # Total size: phase_id + min_green + density + queue + phase_usage + stagnation
        total_size = (num_phases + 1 + 2 * len(self.ts.lanes) + 
                     num_phases + 1)
        
        return spaces.Box(
            low=0.0,
            high=1.0,
            shape=(total_size,),
            dtype=np.float32
        )
    
    def reset(self):
        """Reset tracking between episodes."""
        # Get the actual number of green phases, with fallback
        try:
            num_phases = getattr(self.ts, 'num_green_phases', len(self.phase_usage))
        except (AttributeError, TypeError):
            num_phases = len(self.phase_usage)
        
        self.phase_usage = {i: 0 for i in range(num_phases)}
        self.last_action = None
        self.same_phase_count = 0
        self.step_count = 0
