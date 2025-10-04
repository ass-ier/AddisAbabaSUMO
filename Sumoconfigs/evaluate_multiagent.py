"""
Multi-Agent Traffic Light Control Evaluation

Evaluate trained multi-agent RL models (PPO/DQN) from RLlib checkpoints and compare against fixed-time baseline.

Features:
- Load RLlib checkpoints (PPO or DQN) with automatic algorithm detection
- Evaluate on Addis Ababa network with configurable TLS subset
- Aggregate per-agent metrics (queue, wait, throughput, fairness)
- Compute network-wide statistics (mean, std, min, max)
- Compare against fixed-time baseline
- Generate comparison graphs and JSON reports

Usage examples:
    # Evaluate PPO checkpoint
    python evaluate_multiagent.py --checkpoint ./ray_results/addis_multiagent_ppo/multiagent_ppo/PPO_1/checkpoint_000100
    
    # Evaluate DQN checkpoint
    python evaluate_multiagent.py --checkpoint ./ray_results/addis_multiagent_dqn/multiagent_dqn/DQN_1/checkpoint_000050
    
    # Evaluate with GUI
    python evaluate_multiagent.py --checkpoint <path> --gui
    
    # Evaluate specific TLS subset
    python evaluate_multiagent.py --checkpoint <path> --tls-ids megenagna,meskel_square
"""

import os
import sys
import argparse
import json
import time
import datetime
import numpy as np
import matplotlib.pyplot as plt
import ray
from ray.rllib.algorithms.algorithm import Algorithm
from multiagent_env import create_addis_multiagent_env, get_available_tls
from ray.rllib.env.wrappers.pettingzoo_env import ParallelPettingZooEnv


class FixedTimeMultiAgentController:
    """Baseline controller that cycles through phases with fixed timing for each agent."""
    
    def __init__(self, action_spaces, cycle_length=60):
        """
        Initialize fixed-time controller.
        
        Args:
            action_spaces: Dict of agent_id -> Discrete action space
            cycle_length: Total cycle length in seconds
        """
        self.action_spaces = action_spaces
        self.cycle_length = cycle_length
        self.phase_durations = {}
        self.current_steps = {}
        
        # Calculate phase duration for each agent
        for agent, action_space in action_spaces.items():
            self.phase_durations[agent] = cycle_length // action_space.n
            self.current_steps[agent] = 0
    
    def predict(self, observations):
        """
        Predict actions for all agents based on fixed timing.
        
        Args:
            observations: Dict of agent_id -> observation
            
        Returns:
            Dict of agent_id -> action
        """
        actions = {}
        for agent in observations:
            if agent in self.action_spaces:
                # Calculate current phase based on step count
                phase = (self.current_steps[agent] // self.phase_durations[agent]) % self.action_spaces[agent].n
                actions[agent] = phase
                self.current_steps[agent] += 1
            else:
                actions[agent] = 0  # Default action if agent not in action spaces
        
        return actions
    
    def reset(self):
        """Reset all step counters."""
        self.current_steps = {agent: 0 for agent in self.action_spaces}


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Evaluate multi-agent RL models against fixed-time baseline')
    
    # Checkpoint and model arguments
    parser.add_argument('--checkpoint', type=str, required=True,
                       help='Path to RLlib checkpoint directory')
    parser.add_argument('--algorithm', type=str, choices=['PPO', 'DQN'], default=None,
                       help='Algorithm type (auto-detect if not specified)')
    
    # Environment arguments
    parser.add_argument('--tls-ids', type=str, default=None,
                       help='Comma-separated TLS IDs (default: all available)')
    parser.add_argument('--tls-file', type=str, default=None,
                       help='Path to file containing TLS IDs (one per line)')
    parser.add_argument('--gui', action='store_true',
                       help='Enable SUMO GUI')
    parser.add_argument('--num-seconds', type=int, default=7200,
                       help='Episode duration in seconds (default: 7200)')
    parser.add_argument('--net-file', type=str, default='AddisAbaba.net.xml',
                       help='Network file (default: AddisAbaba.net.xml)')
    parser.add_argument('--route-file', type=str, default='addisTrafficFullNetwork.rou.xml',
                       help='Route file (default: addisTrafficFullNetwork.rou.xml)')
    parser.add_argument('--seed', type=int, default=42,
                       help='Random seed (default: 42)')
    
    # Evaluation arguments
    parser.add_argument('--num-episodes', type=int, default=3,
                       help='Number of evaluation episodes (default: 3)')
    parser.add_argument('--cycle-time', type=int, default=60,
                       help='Fixed-time cycle length for baseline (default: 60)')
    parser.add_argument('--output-dir', type=str, default='./evaluation_results',
                       help='Output directory for results (default: ./evaluation_results)')
    
    return parser.parse_args()


def load_tls_ids_from_file(file_path):
    """Load TLS IDs from file."""
    tls_ids = []
    with open(file_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                tls_ids.append(line)
    return tls_ids


def detect_algorithm_from_checkpoint(checkpoint_path):
    """Auto-detect algorithm type from checkpoint path."""
    if 'PPO' in checkpoint_path:
        return 'PPO'
    elif 'DQN' in checkpoint_path:
        return 'DQN'
    
    # Try to read checkpoint metadata
    try:
        metadata_path = os.path.join(checkpoint_path, 'algorithm_state.pkl')
        if os.path.exists(metadata_path):
            # This is a simplified check - in practice, you might need to load the pickle
            # and inspect the algorithm class
            pass
    except:
        pass
    
    return None


def load_rllib_model(checkpoint_path, algorithm_type):
    """Load trained RLlib algorithm from checkpoint."""
    try:
        # Initialize Ray if not already initialized
        if not ray.is_initialized():
            ray.init(ignore_reinit_error=True)
        
        print(f"Loading {algorithm_type} model from checkpoint: {checkpoint_path}")
        algo = Algorithm.from_checkpoint(checkpoint_path)
        print(f"Successfully loaded {algorithm_type} model")
        return algo
        
    except Exception as e:
        print(f"Error loading model from checkpoint: {e}")
        print("Make sure the checkpoint path is correct and contains a valid RLlib checkpoint")
        sys.exit(1)


def run_evaluation_episode(env, controller, controller_name, max_steps, episode_num):
    """Run single evaluation episode and collect metrics."""
    print(f"Running {controller_name} episode {episode_num}...")
    
    # Reset environment
    obs, info = env.reset()
    
    # Reset controller if it has reset method
    if hasattr(controller, 'reset'):
        controller.reset()
    
    # Initialize metrics collection
    metrics = {
        'per_agent': {agent: {'rewards': [], 'queues': [], 'waits': [], 'speeds': [], 'fairness_scores': []} for agent in env.agents},
        'system': {'total_stopped': [], 'mean_waiting_time': [], 'mean_speed': [], 'total_departed': [], 'fairness_scores': [], 'fairness_std': []}
    }
    
    step_count = 0
    total_reward = {agent: 0.0 for agent in env.agents}
    
    # Run episode
    while step_count < max_steps:
        # Get actions from controller
        if hasattr(controller, 'compute_single_action'):
            # RLlib model
            actions = {}
            for agent in obs:
                actions[agent] = controller.compute_single_action(obs[agent])
        else:
            # Fixed-time controller
            actions = controller.predict(obs)
        
        # Step environment
        obs, rewards, terms, truncs, infos = env.step(actions)
        
        # Collect per-agent metrics
        for agent in env.agents:
            if agent in rewards:
                total_reward[agent] += rewards[agent]
                metrics['per_agent'][agent]['rewards'].append(rewards[agent])
            
            # Extract per-agent metrics from info dict
            if agent in infos:
                info = infos[agent]
                if f'{agent}_stopped' in info:
                    metrics['per_agent'][agent]['queues'].append(info[f'{agent}_stopped'])
                if f'{agent}_accumulated_waiting_time' in info:
                    metrics['per_agent'][agent]['waits'].append(info[f'{agent}_accumulated_waiting_time'])
                if f'{agent}_average_speed' in info:
                    metrics['per_agent'][agent]['speeds'].append(info[f'{agent}_average_speed'])
                if f'{agent}_fairness_score' in info:
                    metrics['per_agent'][agent]['fairness_scores'].append(info[f'{agent}_fairness_score'])
        
        # Collect system metrics from any agent's info (they should be the same)
        if env.agents and env.agents[0] in infos:
            info = infos[env.agents[0]]
            if 'system_total_stopped' in info:
                metrics['system']['total_stopped'].append(info['system_total_stopped'])
            if 'system_mean_waiting_time' in info:
                metrics['system']['mean_waiting_time'].append(info['system_mean_waiting_time'])
            if 'system_mean_speed' in info:
                metrics['system']['mean_speed'].append(info['system_mean_speed'])
            if 'system_total_departed' in info:
                metrics['system']['total_departed'].append(info['system_total_departed'])
            if 'system_fairness_score' in info:
                metrics['system']['fairness_scores'].append(info['system_fairness_score'])
            if 'system_fairness_std' in info:
                metrics['system']['fairness_std'].append(info['system_fairness_std'])
        
        step_count += 1
        
        # Print progress
        if step_count % 500 == 0:
            print(f"  Step {step_count}/{max_steps}")
        
        # Check if any agent is done
        if any(terms.values()) or any(truncs.values()):
            break
    
    # Store final total rewards
    for agent in env.agents:
        metrics['per_agent'][agent]['total_reward'] = total_reward[agent]
    
    print(f"  Completed {controller_name} episode {episode_num} in {step_count} steps")
    return metrics


def aggregate_metrics(metrics_list, num_agents):
    """Compute statistics from collected metrics."""
    if not metrics_list:
        return {}
    
    # Aggregate per-agent metrics across episodes
    per_agent_avg = {}
    per_agent_std = {}
    
    # Calculate averages for each metric type
    for metric_type in ['rewards', 'queues', 'waits', 'speeds', 'fairness_scores']:
        all_values = []
        for episode_metrics in metrics_list:
            for agent_metrics in episode_metrics['per_agent'].values():
                if metric_type in agent_metrics and metric_type != 'total_reward':
                    all_values.extend(agent_metrics[metric_type])
        
        if all_values:
            per_agent_avg[f'avg_{metric_type}'] = np.mean(all_values)
            per_agent_std[f'std_{metric_type}'] = np.std(all_values)
        else:
            per_agent_avg[f'avg_{metric_type}'] = 0.0
            per_agent_std[f'std_{metric_type}'] = 0.0
    
    # Calculate total rewards per agent
    total_rewards = []
    for episode_metrics in metrics_list:
        for agent_metrics in episode_metrics['per_agent'].values():
            if 'total_reward' in agent_metrics:
                total_rewards.append(agent_metrics['total_reward'])
    
    if total_rewards:
        per_agent_avg['avg_total_reward'] = np.mean(total_rewards)
        per_agent_std['std_total_reward'] = np.std(total_rewards)
    else:
        per_agent_avg['avg_total_reward'] = 0.0
        per_agent_std['std_total_reward'] = 0.0
    
    # Aggregate system metrics across episodes
    network_wide = {}
    for metric_type in ['total_stopped', 'mean_waiting_time', 'mean_speed', 'total_departed', 'fairness_scores', 'fairness_std']:
        all_values = []
        for episode_metrics in metrics_list:
            if metric_type in episode_metrics['system']:
                all_values.extend(episode_metrics['system'][metric_type])
        
        if all_values:
            network_wide[metric_type] = np.mean(all_values)
        else:
            network_wide[metric_type] = 0.0
    
    return {
        'per_agent_avg': per_agent_avg,
        'per_agent_std': per_agent_std,
        'network_wide': network_wide,
        'num_agents': num_agents
    }


def plot_multiagent_comparison(rl_stats, fixed_stats, output_dir, algorithm_name):
    """Generate comparison visualizations."""
    os.makedirs(output_dir, exist_ok=True)
    
    fig, axes = plt.subplots(4, 2, figsize=(15, 16))
    fig.suptitle(f'Multi-Agent {algorithm_name} vs Fixed-Time Comparison', fontsize=16)
    
    # Network-wide average queue
    axes[0, 0].bar(['RL Agent', 'Fixed-Time'], 
                   [rl_stats['network_wide']['total_stopped'], 
                    fixed_stats['network_wide']['total_stopped']],
                   color=['#2E8B57', '#DC143C'])
    axes[0, 0].set_title('Network-wide Average Queue')
    axes[0, 0].set_ylabel('Total Stopped Vehicles')
    
    # Network-wide average wait time
    axes[0, 1].bar(['RL Agent', 'Fixed-Time'], 
                   [rl_stats['network_wide']['mean_waiting_time'], 
                    fixed_stats['network_wide']['mean_waiting_time']],
                   color=['#2E8B57', '#DC143C'])
    axes[0, 1].set_title('Network-wide Average Wait Time')
    axes[0, 1].set_ylabel('Mean Waiting Time (s)')
    
    # Network-wide average speed
    axes[1, 0].bar(['RL Agent', 'Fixed-Time'], 
                   [rl_stats['network_wide']['mean_speed'], 
                    fixed_stats['network_wide']['mean_speed']],
                   color=['#2E8B57', '#DC143C'])
    axes[1, 0].set_title('Network-wide Average Speed')
    axes[1, 0].set_ylabel('Mean Speed (m/s)')
    
    # Total departed vehicles
    axes[1, 1].bar(['RL Agent', 'Fixed-Time'], 
                   [rl_stats['network_wide']['total_departed'], 
                    fixed_stats['network_wide']['total_departed']],
                   color=['#2E8B57', '#DC143C'])
    axes[1, 1].set_title('Total Departed Vehicles')
    axes[1, 1].set_ylabel('Total Departed')
    
    # Network-wide fairness score
    axes[2, 0].bar(['RL Agent', 'Fixed-Time'], 
                   [rl_stats['network_wide']['fairness_scores'], 
                    fixed_stats['network_wide']['fairness_scores']],
                   color=['#2E8B57', '#DC143C'])
    axes[2, 0].set_title('Network-wide Fairness Score')
    axes[2, 0].set_ylabel('Fairness Score')
    axes[2, 0].set_ylim(0, 1)
    
    # Network-wide fairness standard deviation
    axes[2, 1].bar(['RL Agent', 'Fixed-Time'], 
                   [rl_stats['network_wide']['fairness_std'], 
                    fixed_stats['network_wide']['fairness_std']],
                   color=['#2E8B57', '#DC143C'])
    axes[2, 1].set_title('Network-wide Fairness Std Dev')
    axes[2, 1].set_ylabel('Fairness Std Dev')
    
    # Per-agent reward distribution (box plot)
    rl_rewards = [rl_stats['per_agent_avg']['avg_total_reward']]
    fixed_rewards = [fixed_stats['per_agent_avg']['avg_total_reward']]
    axes[3, 0].boxplot([rl_rewards, fixed_rewards], labels=['RL Agent', 'Fixed-Time'])
    axes[3, 0].set_title('Per-Agent Reward Distribution')
    axes[3, 0].set_ylabel('Total Reward')
    
    # Improvement percentages
    queue_improvement = ((fixed_stats['network_wide']['total_stopped'] - rl_stats['network_wide']['total_stopped']) 
                        / fixed_stats['network_wide']['total_stopped'] * 100) if fixed_stats['network_wide']['total_stopped'] > 0 else 0
    wait_improvement = ((fixed_stats['network_wide']['mean_waiting_time'] - rl_stats['network_wide']['mean_waiting_time']) 
                       / fixed_stats['network_wide']['mean_waiting_time'] * 100) if fixed_stats['network_wide']['mean_waiting_time'] > 0 else 0
    speed_improvement = ((rl_stats['network_wide']['mean_speed'] - fixed_stats['network_wide']['mean_speed']) 
                        / fixed_stats['network_wide']['mean_speed'] * 100) if fixed_stats['network_wide']['mean_speed'] > 0 else 0
    throughput_improvement = ((rl_stats['network_wide']['total_departed'] - fixed_stats['network_wide']['total_departed']) 
                             / fixed_stats['network_wide']['total_departed'] * 100) if fixed_stats['network_wide']['total_departed'] > 0 else 0
    fairness_improvement = ((rl_stats['network_wide']['fairness_scores'] - fixed_stats['network_wide']['fairness_scores']) 
                           / fixed_stats['network_wide']['fairness_scores'] * 100) if fixed_stats['network_wide']['fairness_scores'] > 0 else 0
    
    improvements = [queue_improvement, wait_improvement, speed_improvement, throughput_improvement, fairness_improvement]
    labels = ['Queue\nReduction', 'Wait\nReduction', 'Speed\nIncrease', 'Throughput\nIncrease', 'Fairness\nImprovement']
    colors = ['green' if imp > 0 else 'red' for imp in improvements]
    
    axes[3, 1].barh(labels, improvements, color=colors)
    axes[3, 1].set_title('Improvement Percentages')
    axes[3, 1].set_xlabel('Improvement (%)')
    axes[3, 1].axvline(x=0, color='black', linestyle='--', alpha=0.5)
    
    plt.tight_layout()
    
    # Save figure
    figure_path = os.path.join(output_dir, f'multiagent_{algorithm_name.lower()}_comparison.png')
    plt.savefig(figure_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    return figure_path


def generate_evaluation_report(rl_stats, fixed_stats, checkpoint_path, algorithm_name, output_dir, num_episodes):
    """Generate JSON evaluation report."""
    os.makedirs(output_dir, exist_ok=True)
    
    # Calculate improvements
    queue_improvement = ((fixed_stats['network_wide']['total_stopped'] - rl_stats['network_wide']['total_stopped']) 
                        / fixed_stats['network_wide']['total_stopped'] * 100) if fixed_stats['network_wide']['total_stopped'] > 0 else 0
    wait_improvement = ((fixed_stats['network_wide']['mean_waiting_time'] - rl_stats['network_wide']['mean_waiting_time']) 
                       / fixed_stats['network_wide']['mean_waiting_time'] * 100) if fixed_stats['network_wide']['mean_waiting_time'] > 0 else 0
    speed_improvement = ((rl_stats['network_wide']['mean_speed'] - fixed_stats['network_wide']['mean_speed']) 
                        / fixed_stats['network_wide']['mean_speed'] * 100) if fixed_stats['network_wide']['mean_speed'] > 0 else 0
    throughput_improvement = ((rl_stats['network_wide']['total_departed'] - fixed_stats['network_wide']['total_departed']) 
                             / fixed_stats['network_wide']['total_departed'] * 100) if fixed_stats['network_wide']['total_departed'] > 0 else 0
    fairness_improvement = ((rl_stats['network_wide']['fairness_scores'] - fixed_stats['network_wide']['fairness_scores']) 
                           / fixed_stats['network_wide']['fairness_scores'] * 100) if fixed_stats['network_wide']['fairness_scores'] > 0 else 0
    
    # Determine overall winner
    positive_improvements = sum([imp > 0 for imp in [queue_improvement, wait_improvement, speed_improvement, throughput_improvement, fairness_improvement]])
    overall_winner = 'RL' if positive_improvements >= 3 else 'Fixed-Time'
    
    # Create report
    report = {
        'timestamp': datetime.datetime.now().isoformat(),
        'checkpoint': checkpoint_path,
        'algorithm': algorithm_name,
        'num_episodes': num_episodes,
        'num_agents': rl_stats['num_agents'],
        'overall_winner': overall_winner,
        'rl_agent': {
            'per_agent_avg': rl_stats['per_agent_avg'],
            'network_wide': rl_stats['network_wide']
        },
        'fixed_time_baseline': {
            'per_agent_avg': fixed_stats['per_agent_avg'],
            'network_wide': fixed_stats['network_wide']
        },
        'improvements': {
            'queue_reduction_pct': queue_improvement,
            'wait_reduction_pct': wait_improvement,
            'speed_increase_pct': speed_improvement,
            'throughput_increase_pct': throughput_improvement,
            'fairness_improvement_pct': fairness_improvement
        },
        'summary': {
            'conclusion': f'{overall_winner} performs better overall',
            'rl_better_at': [],
            'fixed_better_at': []
        }
    }
    
    # Determine which metrics RL is better at
    if queue_improvement > 0:
        report['summary']['rl_better_at'].append('Queue reduction')
    else:
        report['summary']['fixed_better_at'].append('Queue reduction')
    
    if wait_improvement > 0:
        report['summary']['rl_better_at'].append('Wait time reduction')
    else:
        report['summary']['fixed_better_at'].append('Wait time reduction')
    
    if speed_improvement > 0:
        report['summary']['rl_better_at'].append('Speed improvement')
    else:
        report['summary']['fixed_better_at'].append('Speed improvement')
    
    if throughput_improvement > 0:
        report['summary']['rl_better_at'].append('Throughput improvement')
    else:
        report['summary']['fixed_better_at'].append('Throughput improvement')
    
    if fairness_improvement > 0:
        report['summary']['rl_better_at'].append('Fairness improvement')
    else:
        report['summary']['fixed_better_at'].append('Fairness improvement')
    
    # Save report
    report_path = os.path.join(output_dir, f'multiagent_{algorithm_name.lower()}_evaluation_report.json')
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    return report


def print_evaluation_summary(report):
    """Print human-readable summary to console."""
    print("\n" + "="*80)
    print("MULTI-AGENT TRAFFIC LIGHT CONTROL EVALUATION SUMMARY")
    print("="*80)
    print(f"Timestamp: {report['timestamp']}")
    print(f"Checkpoint: {report['checkpoint']}")
    print(f"Algorithm: {report['algorithm']}")
    print(f"Episodes: {report['num_episodes']}")
    print(f"Agents: {report['num_agents']}")
    print(f"Overall Winner: {report['overall_winner']}")
    print()
    
    print("NETWORK-WIDE METRICS COMPARISON:")
    print("-" * 50)
    rl_net = report['rl_agent']['network_wide']
    fixed_net = report['fixed_time_baseline']['network_wide']
    
    print(f"{'Metric':<25} {'RL Agent':<15} {'Fixed-Time':<15} {'Improvement':<15}")
    print("-" * 70)
    print(f"{'Total Stopped':<25} {rl_net['total_stopped']:<15.2f} {fixed_net['total_stopped']:<15.2f} {report['improvements']['queue_reduction_pct']:<15.2f}%")
    print(f"{'Mean Wait Time':<25} {rl_net['mean_waiting_time']:<15.2f} {fixed_net['mean_waiting_time']:<15.2f} {report['improvements']['wait_reduction_pct']:<15.2f}%")
    print(f"{'Mean Speed':<25} {rl_net['mean_speed']:<15.2f} {fixed_net['mean_speed']:<15.2f} {report['improvements']['speed_increase_pct']:<15.2f}%")
    print(f"{'Total Departed':<25} {rl_net['total_departed']:<15.2f} {fixed_net['total_departed']:<15.2f} {report['improvements']['throughput_increase_pct']:<15.2f}%")
    print(f"{'Fairness Score':<25} {rl_net['fairness_scores']:<15.2f} {fixed_net['fairness_scores']:<15.2f} {report['improvements']['fairness_improvement_pct']:<15.2f}%")
    print()
    
    print("IMPROVEMENT SUMMARY:")
    print("-" * 30)
    for metric, improvement in report['improvements'].items():
        status = "✓" if improvement > 0 else "✗"
        print(f"{status} {metric.replace('_', ' ').title()}: {improvement:.2f}%")
    print()
    
    print("CONCLUSION:")
    print("-" * 20)
    print(f"• {report['summary']['conclusion']}")
    if report['summary']['rl_better_at']:
        print(f"• RL Agent performs better at: {', '.join(report['summary']['rl_better_at'])}")
    if report['summary']['fixed_better_at']:
        print(f"• Fixed-Time performs better at: {', '.join(report['summary']['fixed_better_at'])}")
    print()


def main():
    """Main evaluation function."""
    args = parse_arguments()
    
    # Validate checkpoint exists
    if not os.path.exists(args.checkpoint):
        print(f"Error: Checkpoint path does not exist: {args.checkpoint}")
        sys.exit(1)
    
    # Detect algorithm type
    algorithm_type = args.algorithm
    if algorithm_type is None:
        algorithm_type = detect_algorithm_from_checkpoint(args.checkpoint)
        if algorithm_type is None:
            print("Error: Could not auto-detect algorithm type. Please specify --algorithm PPO or --algorithm DQN")
            sys.exit(1)
    
    # Parse TLS IDs
    tls_ids = None
    if args.tls_ids:
        tls_ids = [tid.strip() for tid in args.tls_ids.split(',')]
    elif args.tls_file:
        tls_ids = load_tls_ids_from_file(args.tls_file)
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Print evaluation header
    print("="*80)
    print("MULTI-AGENT TRAFFIC LIGHT CONTROL EVALUATION")
    print("="*80)
    print(f"Checkpoint: {args.checkpoint}")
    print(f"Algorithm: {algorithm_type}")
    print(f"TLS IDs: {tls_ids if tls_ids else 'All available'}")
    print(f"Episodes: {args.num_episodes}")
    print(f"Episode Duration: {args.num_seconds} seconds")
    print(f"GUI: {'Enabled' if args.gui else 'Disabled'}")
    print(f"Output Directory: {args.output_dir}")
    print()
    
    # Load RLlib model
    print(f"Loading {algorithm_type} model from checkpoint...")
    rl_model = load_rllib_model(args.checkpoint, algorithm_type)
    
    # Create evaluation environment
    print("Creating evaluation environment...")
    env = ParallelPettingZooEnv(
        create_addis_multiagent_env(
            net_file=args.net_file,
            route_file=args.route_file,
            use_gui=args.gui,
            num_seconds=args.num_seconds,
            tls_ids=tls_ids,
            sumo_seed=args.seed
        )
    )
    
    # Get number of agents and TLS IDs from environment
    num_agents = len(env.agents)
    env_tls_ids = list(env.agents)
    print(f"Environment created with {num_agents} agents: {env_tls_ids}")
    print()
    
    # Evaluate RL agent
    print("EVALUATING RL AGENT")
    print("-" * 30)
    rl_metrics_list = []
    for episode in range(args.num_episodes):
        metrics = run_evaluation_episode(env, rl_model, f"{algorithm_type} Agent", args.num_seconds, episode + 1)
        rl_metrics_list.append(metrics)
    
    # Close environment
    env.close()
    
    # Aggregate RL metrics
    rl_stats = aggregate_metrics(rl_metrics_list, num_agents)
    
    # Evaluate fixed-time baseline
    print("\nEVALUATING FIXED-TIME BASELINE")
    print("-" * 40)
    
    # Create new environment for baseline
    baseline_env = ParallelPettingZooEnv(
        create_addis_multiagent_env(
            net_file=args.net_file,
            route_file=args.route_file,
            use_gui=False,  # Disable GUI for baseline
            num_seconds=args.num_seconds,
            tls_ids=tls_ids,
            sumo_seed=args.seed
        )
    )
    
    # Reset baseline environment to populate agents and action spaces
    baseline_obs, baseline_info = baseline_env.reset()
    
    # Create fixed-time controller after reset to ensure action spaces are populated
    fixed_controller = FixedTimeMultiAgentController(
        {agent: baseline_env.action_space(agent) for agent in baseline_env.agents},
        cycle_length=args.cycle_time
    )
    
    fixed_metrics_list = []
    for episode in range(args.num_episodes):
        metrics = run_evaluation_episode(baseline_env, fixed_controller, "Fixed-Time", args.num_seconds, episode + 1)
        fixed_metrics_list.append(metrics)
    
    # Close baseline environment
    baseline_env.close()
    
    # Aggregate fixed-time metrics
    fixed_stats = aggregate_metrics(fixed_metrics_list, num_agents)
    
    # Generate comparison
    print("\nGENERATING COMPARISON")
    print("-" * 25)
    
    # Plot comparison graphs
    figure_path = plot_multiagent_comparison(rl_stats, fixed_stats, args.output_dir, algorithm_type)
    print(f"Comparison graph saved: {figure_path}")
    
    # Generate JSON report
    report = generate_evaluation_report(rl_stats, fixed_stats, args.checkpoint, algorithm_type, args.output_dir, args.num_episodes)
    report_path = os.path.join(args.output_dir, f'multiagent_{algorithm_type.lower()}_evaluation_report.json')
    print(f"Evaluation report saved: {report_path}")
    
    # Print summary
    print_evaluation_summary(report)
    
    # Print output file paths
    print("OUTPUT FILES:")
    print("-" * 15)
    print(f"• Comparison Graph: {figure_path}")
    print(f"• Evaluation Report: {report_path}")
    print(f"• Output Directory: {args.output_dir}")
    
    # Shutdown Ray
    if ray.is_initialized():
        ray.shutdown()
    
    print("\nEvaluation completed successfully!")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\nEvaluation interrupted by user")
        sys.exit(1)
    except FileNotFoundError as e:
        print(f"Error: File not found - {e}")
        print("Make sure SUMO_HOME is set and all required files exist")
        sys.exit(1)
    except ImportError as e:
        print(f"Error: Missing dependency - {e}")
        print("Make sure all required packages are installed: pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        print("Check the error message above for details")
        sys.exit(1)
