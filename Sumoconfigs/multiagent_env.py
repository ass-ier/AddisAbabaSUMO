"""
Multi-agent traffic light control environment for Addis Ababa network using SUMO-RL.

This module provides a professional multi-agent reinforcement learning environment
with custom fairness metrics, configurable TLS subset selection, and compatibility
with major MARL frameworks like Stable-Baselines3 and RLlib.
"""

import os
import sys
import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Dict, Any

# Add sumo-rl to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'sumo-rl'))
import sumo_rl
from pettingzoo.utils import BaseParallelWrapper

# Import custom classes (this triggers registration)
from fairness_observation import FairnessObservationFunction
import fairness_reward


class FairnessInfoWrapper(BaseParallelWrapper):
    """
    Wrapper to add fairness metrics to the info dict.
    
    Extracts fairness metrics from the observation function and adds them to the info dict
    for each agent and system-wide.
    """
    
    def __init__(self, env):
        """
        Initialize fairness info wrapper.
        
        Args:
            env: Base parallel environment
        """
        super().__init__(env)
    
    def observation_space(self, agent):
        """Return the observation space for the agent."""
        return self.env.observation_space(agent)

    def action_space(self, agent):
        """Return the action space for the agent."""
        return self.env.action_space(agent)
    
    def reset(self, seed=None, options=None):
        """Reset environment and add fairness info."""
        obs, info = self.env.reset(seed=seed, options=options)
        # Add fairness metrics to info dict
        self._add_fairness_info(info)
        return obs, info
    
    def step(self, actions):
        """Step environment and add fairness info."""
        obs, rewards, terms, truncs, infos = self.env.step(actions)
        
        # Add fairness metrics to info dict for each agent
        for agent in infos:
            self._add_fairness_info(infos[agent])
        
        return obs, rewards, terms, truncs, infos
    
    def _add_fairness_info(self, info_dict):
        """Add fairness metrics to info dict."""
        # Add system-wide fairness metrics
        if hasattr(self.env, 'traffic_signals'):
            fairness_scores = []
            for ts_id, ts in self.env.traffic_signals.items():
                if hasattr(ts, 'observation_fn') and hasattr(ts.observation_fn, 'phase_usage'):
                    # Calculate fairness score for this traffic signal
                    phase_usage = ts.observation_fn.phase_usage
                    total_usage = sum(phase_usage.values())
                    
                    if total_usage > 0 and ts.observation_fn.step_count > 100:
                        # Normalize usage
                        usage_values = [phase_usage.get(i, 0) / total_usage for i in range(ts.num_green_phases)]
                        # Compute expected uniform usage
                        expected_usage = 1.0 / ts.num_green_phases
                        # Compute variance
                        variance = sum((u - expected_usage)**2 for u in usage_values) / ts.num_green_phases
                        # Compute fairness score
                        fairness_score = max(0, 1.0 - variance * 10)
                    else:
                        fairness_score = 1.0
                    
                    fairness_scores.append(fairness_score)
                    info_dict[f'{ts_id}_fairness_score'] = fairness_score
                else:
                    fairness_scores.append(1.0)
                    info_dict[f'{ts_id}_fairness_score'] = 1.0
            
            # Add system-wide fairness metrics
            if fairness_scores:
                info_dict['system_fairness_score'] = sum(fairness_scores) / len(fairness_scores)
                info_dict['system_fairness_std'] = np.std(fairness_scores) if len(fairness_scores) > 1 else 0.0
            else:
                info_dict['system_fairness_score'] = 1.0
                info_dict['system_fairness_std'] = 0.0


class TLSFilterWrapper(BaseParallelWrapper):
    """
    Wrapper to filter parallel environment to control only a subset of traffic signals.
    
    Allows training on specific intersections while ignoring others in the network.
    """
    
    def __init__(self, env, tls_ids=None):
        """
        Initialize TLS filter wrapper.
        
        Args:
            env: Base parallel environment
            tls_ids: List of traffic signal IDs to control (None = all)
        """
        super().__init__(env)
        self.selected_tls = tls_ids if tls_ids else env.possible_agents
        self.possible_agents = self.selected_tls
        self.agents = [a for a in env.agents if a in self.selected_tls]
        self.observation_spaces = {a: env.observation_spaces[a] for a in self.selected_tls}
        self.action_spaces = {a: env.action_spaces[a] for a in self.selected_tls}
    
    def observation_space(self, agent):
        """Return the observation space for the agent."""
        if agent in self.selected_tls:
            return self.observation_spaces[agent]
        raise ValueError(f"Agent {agent} is not in selected traffic light signals: {self.selected_tls}")

    def action_space(self, agent):
        """Return the action space for the agent."""
        if agent in self.selected_tls:
            return self.action_spaces[agent]
        raise ValueError(f"Agent {agent} is not in selected traffic light signals: {self.selected_tls}")
    
    def reset(self, seed=None, options=None):
        """Reset environment and filter observations."""
        obs, info = self.env.reset(seed=seed, options=options)
        # Filter observations to only selected TLS and sync active agents
        filtered_obs = {a: obs[a] for a in obs if a in self.selected_tls}
        self.agents = list(filtered_obs.keys())
        return filtered_obs, info
    
    def step(self, actions):
        """Step environment with filtered actions."""
        # Forward only actions for selected agents; leave others unchanged
        forwarded_actions = {a: act for a, act in actions.items() if a in self.selected_tls and a in self.env.agents}
        obs, rewards, terms, truncs, infos = self.env.step(forwarded_actions)
        
        # Filter all return dicts to only include selected TLS and sync active agents
        filtered_obs = {a: obs[a] for a in obs if a in self.selected_tls}
        self.agents = list(filtered_obs.keys())
        filtered_rewards = {a: rewards[a] for a in rewards if a in self.selected_tls}
        filtered_terms = {a: terms[a] for a in terms if a in self.selected_tls}
        filtered_truncs = {a: truncs[a] for a in truncs if a in self.selected_tls}
        filtered_infos = {a: infos[a] for a in infos if a in self.selected_tls}
        
        return filtered_obs, filtered_rewards, filtered_terms, filtered_truncs, filtered_infos


@dataclass
class MultiAgentEnvConfig:
    """Type-safe configuration object for multi-agent environment."""
    
    net_file: str = 'AddisAbaba.net.xml'
    route_file: str = 'addisTrafficFullNetwork.rou.xml'
    use_gui: bool = False
    num_seconds: int = 7200
    delta_time: int = 5
    yellow_time: int = 3
    min_green: int = 5
    max_green: int = 60
    tls_ids: Optional[List[str]] = None
    sumo_seed: int = 42
    out_csv_name: Optional[str] = None
    additional_sumo_cmd: str = '--additional-files vehicleTypesFixed.add.xml,detectors.add.xml'
    
    def to_env_kwargs(self) -> Dict[str, Any]:
        """Convert config to keyword arguments for create_addis_multiagent_env."""
        return {
            'net_file': self.net_file,
            'route_file': self.route_file,
            'use_gui': self.use_gui,
            'num_seconds': self.num_seconds,
            'delta_time': self.delta_time,
            'yellow_time': self.yellow_time,
            'min_green': self.min_green,
            'max_green': self.max_green,
            'tls_ids': self.tls_ids,
            'sumo_seed': self.sumo_seed,
            'out_csv_name': self.out_csv_name,
            'additional_sumo_cmd': self.additional_sumo_cmd
        }


def create_addis_multiagent_env(
    net_file='AddisAbaba.net.xml',
    route_file='addisTrafficFullNetwork.rou.xml',
    use_gui=False,
    num_seconds=7200,
    delta_time=5,
    yellow_time=3,
    min_green=5,
    max_green=60,
    out_csv_name=None,
    sumo_seed=42,
    tls_ids=None,
    additional_sumo_cmd=None,
    **kwargs
):
    """
    Factory function to create configured parallel environment for Addis Ababa network.
    
    Args:
        net_file: Network file path
        route_file: Route file path
        use_gui: Enable SUMO GUI
        num_seconds: Simulation duration
        delta_time: Decision interval
        yellow_time: Yellow phase duration
        min_green: Minimum green time
        max_green: Maximum green time
        out_csv_name: Output CSV path
        sumo_seed: Random seed
        tls_ids: List of TLS to control (None = all)
        additional_sumo_cmd: Additional SUMO command line arguments
        **kwargs: Additional arguments passed to parallel_env
        
    Returns:
        Configured parallel environment (optionally wrapped with TLS filter)
    """
    if additional_sumo_cmd is None:
        additional_sumo_cmd = '--additional-files vehicleTypesFixed.add.xml,detectors.add.xml'
    
    # Create base parallel environment
    env = sumo_rl.parallel_env(
        net_file=net_file,
        route_file=route_file,
        use_gui=use_gui,
        num_seconds=num_seconds,
        delta_time=delta_time,
        yellow_time=yellow_time,
        min_green=min_green,
        max_green=max_green,
        observation_class=FairnessObservationFunction,
        reward_fn='fairness_combined_reward',
        out_csv_name=out_csv_name,
        sumo_seed=sumo_seed,
        sumo_warnings=False,
        add_system_info=True,
        add_per_agent_info=True,
        additional_sumo_cmd=additional_sumo_cmd,
        **kwargs
    )
    
    # Wrap with fairness info wrapper to add fairness metrics to info dict
    env = FairnessInfoWrapper(env)
    
    # Optionally wrap with TLS filter
    if tls_ids is not None:
        env = TLSFilterWrapper(env, tls_ids=tls_ids)
    
    return env


def get_available_tls(net_file='AddisAbaba.net.xml') -> List[str]:
    """
    Discover available traffic signals in the network.
    
    Args:
        net_file: Network file path
        
    Returns:
        List of traffic signal IDs
    """
    try:
        import traci
        # Use compatible SUMO command line options
        traci.start(['sumo', '--net-file', net_file, '--no-step-log', '--duration', '1'])
        tls_list = traci.trafficlight.getIDList()
        traci.close()
        return tls_list
    except Exception as e:
        print(f"Warning: Could not discover TLS from {net_file}: {e}")
        return []


def get_observation_space_info(env) -> Dict[str, Any]:
    """
    Get observation space information for introspection.
    
    Args:
        env: Environment instance
        
    Returns:
        Dictionary with observation space information
    """
    return {
        'agents': env.possible_agents,
        'observation_shapes': {agent: env.observation_space(agent).shape for agent in env.possible_agents},
        'action_spaces': {agent: env.action_space(agent).n for agent in env.possible_agents}
    }


if __name__ == '__main__':
    """Test the environment setup."""
    print("Testing Addis Ababa Multi-Agent Environment")
    print("=" * 50)
    
    try:
        # Create environment with default settings
        env = create_addis_multiagent_env(use_gui=False, num_seconds=100)
        
        # Print available agents
        print(f"Available agents: {len(env.possible_agents)}")
        print(f"Agent IDs: {env.possible_agents[:5]}..." if len(env.possible_agents) > 5 else f"Agent IDs: {env.possible_agents}")
        
        # Print observation/action space shapes
        info = get_observation_space_info(env)
        print(f"Observation shapes: {list(info['observation_shapes'].values())[:3]}...")
        print(f"Action spaces: {list(info['action_spaces'].values())[:3]}...")
        
        # Run one episode
        obs, info = env.reset(seed=42)
        print(f"Reset successful. Agents in episode: {len(obs)}")
        
        # Run 10 random steps
        for step in range(10):
            actions = {agent: env.action_space(agent).sample() for agent in env.agents}
            obs, rewards, terms, truncs, infos = env.step(actions)
            total_reward = sum(rewards.values())
            print(f"Step {step+1}: Total reward = {total_reward:.3f}")
            
            if any(terms.values()) or any(truncs.values()):
                print("Episode ended early")
                break
        
        env.close()
        print("Environment test completed successfully!")
        
    except Exception as e:
        print(f"Error during testing: {e}")
        print("Make sure SUMO-RL is installed: cd sumo-rl && pip install -e .")
