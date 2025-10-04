"""
Model Evaluation Script for Addis Ababa Traffic Light RL
========================================================

Comprehensive evaluation of trained traffic light control models with:
- Performance comparison against baseline
- Detailed traffic metrics analysis
- Fairness evaluation (anti-starvation measures)
- Visualization of results
- Export of evaluation reports
"""

import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import argparse

# ML imports
from stable_baselines3 import PPO
from stable_baselines3.common.monitor import Monitor

# Custom environment
from addis_traffic_env import AddisTrafficEnvironment
from train_addis_ppo import FixedTimeBaseline

class ModelEvaluator:
    """Comprehensive model evaluation for traffic light control"""
    
    def __init__(self, model_path: str, config: Dict):
        self.model_path = model_path
        self.config = config
        self.model = None
        self.env = None
        self.results = {}
        
    def load_model_and_env(self):
        """Load trained model and create evaluation environment"""
        print("Loading model and environment...")
        
        # Create evaluation environment
        self.env = AddisTrafficEnvironment(
            net_file=self.config['net_file'],
            route_file=self.config['route_file'],
            sumocfg_file=self.config.get('sumocfg_file'),
            use_gui=self.config.get('use_gui', False),
            num_seconds=self.config.get('num_seconds', 3600),
            delta_time=self.config.get('delta_time', 5),
            min_green=self.config.get('min_green', 10),
            max_red=self.config.get('max_red', 60),
            yellow_time=self.config.get('yellow_time', 4)
        )
        
        # Load trained model
        self.model = PPO.load(self.model_path)
        print(f"Model loaded from: {self.model_path}")
    
    def evaluate_single_episode(self, deterministic=True, verbose=False):
        """Evaluate a single episode and return detailed metrics"""
        obs = self.env.reset()
        
        episode_data = {
            'rewards': [],
            'actions': [],
            'waiting_times': [],
            'throughput': [],
            'speeds': [],
            'queue_lengths': [],
            'phase_switches': [],
            'step_data': []
        }
        
        total_reward = 0
        step_count = 0
        
        while True:
            # Get action from model
            action, _ = self.model.predict(obs, deterministic=deterministic)
            episode_data['actions'].append(action)
            
            # Execute action
            obs, reward, done, truncated, info = self.env.step(action)
            
            # Record metrics
            total_reward += reward
            episode_data['rewards'].append(reward)
            episode_data['waiting_times'].append(info.get('total_waiting_time', 0))
            episode_data['throughput'].append(info.get('total_vehicles', 0))
            episode_data['speeds'].append(info.get('avg_speed', 0))
            
            # Record detailed step data
            step_info = {
                'step': step_count,
                'reward': reward,
                'total_reward': total_reward,
                'action': action,
                'simulation_step': info.get('simulation_step', 0),
                'num_traffic_lights': info.get('num_traffic_lights', 0),
                'total_vehicles': info.get('total_vehicles', 0),
                'total_waiting_time': info.get('total_waiting_time', 0),
                'avg_speed': info.get('avg_speed', 0)
            }
            episode_data['step_data'].append(step_info)
            
            step_count += 1
            
            if verbose and step_count % 50 == 0:
                print(f"Step {step_count}: Reward={reward:.3f}, Total={total_reward:.2f}, "
                      f"Vehicles={info.get('total_vehicles', 0)}")
            
            if done:
                break
        
        episode_data['total_reward'] = total_reward
        episode_data['episode_length'] = step_count
        episode_data['final_throughput'] = episode_data['throughput'][-1] if episode_data['throughput'] else 0
        episode_data['avg_waiting_time'] = np.mean(episode_data['waiting_times']) if episode_data['waiting_times'] else 0
        episode_data['avg_speed'] = np.mean(episode_data['speeds']) if episode_data['speeds'] else 0
        
        return episode_data
    
    def evaluate_multiple_episodes(self, n_episodes=10, deterministic=True):
        """Evaluate multiple episodes and aggregate results"""
        print(f"Evaluating {n_episodes} episodes...")
        
        all_episodes = []
        summary_metrics = []
        
        for episode in range(n_episodes):
            print(f"Episode {episode + 1}/{n_episodes}")
            
            episode_data = self.evaluate_single_episode(deterministic=deterministic)
            all_episodes.append(episode_data)
            
            # Summary metrics for this episode
            summary_metrics.append({
                'episode': episode,
                'total_reward': episode_data['total_reward'],
                'episode_length': episode_data['episode_length'],
                'final_throughput': episode_data['final_throughput'],
                'avg_waiting_time': episode_data['avg_waiting_time'],
                'avg_speed': episode_data['avg_speed'],
                'reward_per_step': episode_data['total_reward'] / episode_data['episode_length']
            })
            
            print(f"  Episode {episode + 1} - Reward: {episode_data['total_reward']:.2f}, "
                  f"Length: {episode_data['episode_length']}, "
                  f"Throughput: {episode_data['final_throughput']}")
        
        # Aggregate statistics
        rewards = [ep['total_reward'] for ep in all_episodes]
        lengths = [ep['episode_length'] for ep in all_episodes]
        throughputs = [ep['final_throughput'] for ep in all_episodes]
        waiting_times = [ep['avg_waiting_time'] for ep in all_episodes]
        speeds = [ep['avg_speed'] for ep in all_episodes]
        
        self.results = {
            'episodes': all_episodes,
            'summary': summary_metrics,
            'aggregated': {
                'mean_reward': np.mean(rewards),
                'std_reward': np.std(rewards),
                'mean_length': np.mean(lengths),
                'mean_throughput': np.mean(throughputs),
                'std_throughput': np.std(throughputs),
                'mean_waiting_time': np.mean(waiting_times),
                'std_waiting_time': np.std(waiting_times),
                'mean_speed': np.mean(speeds),
                'std_speed': np.std(speeds),
                'reward_per_step': np.mean([r/l for r, l in zip(rewards, lengths)])
            }
        }
        
        return self.results
    
    def evaluate_baseline_comparison(self, n_episodes=5):
        """Compare against fixed-time baseline"""
        print("Evaluating baseline comparison...")
        
        # Evaluate RL model
        rl_results = self.evaluate_multiple_episodes(n_episodes, deterministic=True)
        
        # Evaluate baseline
        baseline = FixedTimeBaseline(self.env, green_time=30, yellow_time=4)
        baseline_rewards, baseline_metrics = baseline.evaluate(num_episodes=n_episodes)
        
        # Calculate improvements
        rl_mean_reward = rl_results['aggregated']['mean_reward']
        baseline_mean_reward = np.mean(baseline_rewards)
        
        rl_mean_waiting = rl_results['aggregated']['mean_waiting_time']
        baseline_mean_waiting = np.mean([m['avg_waiting_time'] for m in baseline_metrics])
        
        rl_mean_throughput = rl_results['aggregated']['mean_throughput']
        baseline_mean_throughput = np.mean([m['throughput'] for m in baseline_metrics])
        
        comparison = {
            'rl_reward': rl_mean_reward,
            'baseline_reward': baseline_mean_reward,
            'reward_improvement': ((rl_mean_reward - baseline_mean_reward) / abs(baseline_mean_reward) * 100),
            
            'rl_waiting_time': rl_mean_waiting,
            'baseline_waiting_time': baseline_mean_waiting,
            'waiting_time_improvement': ((baseline_mean_waiting - rl_mean_waiting) / baseline_mean_waiting * 100),
            
            'rl_throughput': rl_mean_throughput,
            'baseline_throughput': baseline_mean_throughput,
            'throughput_improvement': ((rl_mean_throughput - baseline_mean_throughput) / baseline_mean_throughput * 100)
        }
        
        self.results['baseline_comparison'] = comparison
        self.results['baseline_data'] = baseline_metrics
        
        return comparison
    
    def evaluate_fairness_metrics(self):
        """Evaluate fairness and anti-starvation performance"""
        print("Evaluating fairness metrics...")
        
        if not hasattr(self.env, 'traffic_lights') or not self.env.traffic_lights:
            print("Warning: No traffic lights found for fairness evaluation")
            return {}
        
        # Run one episode and collect fairness data
        obs = self.env.reset()
        fairness_data = {
            'lane_waiting_times': {},
            'lane_green_times': {},
            'phase_switches': {},
            'starvation_events': 0
        }
        
        step_count = 0
        while step_count < 1000:  # Evaluate for 1000 steps
            action, _ = self.model.predict(obs, deterministic=True)
            obs, reward, done, truncated, info = self.env.step(action)
            
            # Collect fairness metrics from traffic lights
            for tls_id, tls in self.env.traffic_lights.items():
                if tls_id not in fairness_data['phase_switches']:
                    fairness_data['phase_switches'][tls_id] = 0
                
                # Check for phase switches
                current_switches = tls.phase_switches
                if tls_id in fairness_data and 'last_switches' in fairness_data:
                    if current_switches > fairness_data['last_switches'].get(tls_id, 0):
                        fairness_data['phase_switches'][tls_id] += 1
                
                # Collect lane metrics
                lane_metrics = tls.get_lane_metrics()
                for lane, metrics in lane_metrics.items():
                    if lane not in fairness_data['lane_waiting_times']:
                        fairness_data['lane_waiting_times'][lane] = []
                    fairness_data['lane_waiting_times'][lane].append(metrics['waiting_time'])
                
                # Check for starvation
                current_green_lanes = tls._get_current_green_lanes()
                for lane in tls.controlled_lanes:
                    if lane not in current_green_lanes:
                        time_since_green = self.env.simulation_step - tls.lane_last_green[lane]
                        if time_since_green > tls.max_red_time * 0.9:  # 90% of max red time
                            fairness_data['starvation_events'] += 1
            
            step_count += 1
            if done:
                break
        
        # Calculate fairness statistics
        lane_waiting_stats = {}
        for lane, waiting_times in fairness_data['lane_waiting_times'].items():
            if waiting_times:
                lane_waiting_stats[lane] = {
                    'mean': np.mean(waiting_times),
                    'max': np.max(waiting_times),
                    'std': np.std(waiting_times)
                }
        
        # Fairness score based on waiting time variance
        if lane_waiting_stats:
            mean_waiting_times = [stats['mean'] for stats in lane_waiting_stats.values()]
            fairness_score = 1.0 / (1.0 + np.var(mean_waiting_times))  # Higher is more fair
        else:
            fairness_score = 0.0
        
        fairness_results = {
            'fairness_score': fairness_score,
            'lane_waiting_stats': lane_waiting_stats,
            'total_starvation_events': fairness_data['starvation_events'],
            'avg_phase_switches': np.mean(list(fairness_data['phase_switches'].values())) if fairness_data['phase_switches'] else 0
        }
        
        self.results['fairness'] = fairness_results
        return fairness_results
    
    def generate_report(self, output_dir):
        """Generate comprehensive evaluation report"""
        print(f"Generating evaluation report in {output_dir}")
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Save detailed results
        if 'summary' in self.results:
            pd.DataFrame(self.results['summary']).to_csv(f"{output_dir}/episode_summary.csv", index=False)
        
        if 'baseline_data' in self.results:
            pd.DataFrame(self.results['baseline_data']).to_csv(f"{output_dir}/baseline_results.csv", index=False)
        
        # Generate plots
        self._plot_performance_comparison(output_dir)
        self._plot_episode_progression(output_dir)
        self._plot_fairness_analysis(output_dir)
        
        # Generate text report
        self._generate_text_report(output_dir)
        
        print(f"Report generated successfully in {output_dir}")
    
    def _plot_performance_comparison(self, output_dir):
        """Generate performance comparison plots"""
        if 'baseline_comparison' not in self.results:
            return
        
        comparison = self.results['baseline_comparison']
        
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        fig.suptitle('RL vs Baseline Performance Comparison', fontsize=16)
        
        # Reward comparison
        axes[0].bar(['Baseline', 'RL Agent'], 
                   [comparison['baseline_reward'], comparison['rl_reward']],
                   color=['red', 'blue'], alpha=0.7)
        axes[0].set_title('Episode Reward')
        axes[0].set_ylabel('Average Reward')
        
        # Waiting time comparison
        axes[1].bar(['Baseline', 'RL Agent'],
                   [comparison['baseline_waiting_time'], comparison['rl_waiting_time']],
                   color=['red', 'blue'], alpha=0.7)
        axes[1].set_title('Average Waiting Time')
        axes[1].set_ylabel('Waiting Time (seconds)')
        
        # Throughput comparison
        axes[2].bar(['Baseline', 'RL Agent'],
                   [comparison['baseline_throughput'], comparison['rl_throughput']],
                   color=['red', 'blue'], alpha=0.7)
        axes[2].set_title('Vehicle Throughput')
        axes[2].set_ylabel('Total Vehicles')
        
        plt.tight_layout()
        plt.savefig(f"{output_dir}/performance_comparison.png", dpi=300, bbox_inches='tight')
        plt.close()
    
    def _plot_episode_progression(self, output_dir):
        """Plot episode-by-episode progression"""
        if 'summary' not in self.results:
            return
        
        summary_df = pd.DataFrame(self.results['summary'])
        
        fig, axes = plt.subplots(2, 2, figsize=(12, 8))
        fig.suptitle('Episode-by-Episode Performance', fontsize=16)
        
        # Episode rewards
        axes[0, 0].plot(summary_df['episode'], summary_df['total_reward'], 'o-')
        axes[0, 0].set_title('Episode Rewards')
        axes[0, 0].set_xlabel('Episode')
        axes[0, 0].set_ylabel('Total Reward')
        axes[0, 0].grid(True)
        
        # Episode lengths
        axes[0, 1].plot(summary_df['episode'], summary_df['episode_length'], 'o-', color='orange')
        axes[0, 1].set_title('Episode Lengths')
        axes[0, 1].set_xlabel('Episode')
        axes[0, 1].set_ylabel('Steps')
        axes[0, 1].grid(True)
        
        # Waiting times
        axes[1, 0].plot(summary_df['episode'], summary_df['avg_waiting_time'], 'o-', color='red')
        axes[1, 0].set_title('Average Waiting Time')
        axes[1, 0].set_xlabel('Episode')
        axes[1, 0].set_ylabel('Waiting Time (seconds)')
        axes[1, 0].grid(True)
        
        # Throughput
        axes[1, 1].plot(summary_df['episode'], summary_df['final_throughput'], 'o-', color='green')
        axes[1, 1].set_title('Vehicle Throughput')
        axes[1, 1].set_xlabel('Episode')
        axes[1, 1].set_ylabel('Total Vehicles')
        axes[1, 1].grid(True)
        
        plt.tight_layout()
        plt.savefig(f"{output_dir}/episode_progression.png", dpi=300, bbox_inches='tight')
        plt.close()
    
    def _plot_fairness_analysis(self, output_dir):
        """Plot fairness analysis"""
        if 'fairness' not in self.results:
            return
        
        fairness = self.results['fairness']
        
        if not fairness.get('lane_waiting_stats'):
            return
        
        # Waiting time distribution across lanes
        lane_names = list(fairness['lane_waiting_stats'].keys())[:10]  # Top 10 lanes
        mean_waiting = [fairness['lane_waiting_stats'][lane]['mean'] for lane in lane_names]
        std_waiting = [fairness['lane_waiting_stats'][lane]['std'] for lane in lane_names]
        
        plt.figure(figsize=(12, 6))
        
        plt.subplot(1, 2, 1)
        plt.errorbar(range(len(lane_names)), mean_waiting, yerr=std_waiting, 
                     fmt='o-', capsize=5, capthick=2)
        plt.title('Average Waiting Time by Lane')
        plt.xlabel('Lane Index')
        plt.ylabel('Waiting Time (seconds)')
        plt.xticks(range(len(lane_names)), [f"Lane {i}" for i in range(len(lane_names))])
        plt.grid(True)
        
        plt.subplot(1, 2, 2)
        # Fairness metrics summary
        metrics = ['Fairness Score', 'Starvation Events', 'Avg Phase Switches']
        values = [fairness['fairness_score'], fairness['total_starvation_events'], 
                 fairness['avg_phase_switches']]
        
        plt.bar(metrics, values, alpha=0.7)
        plt.title('Fairness Metrics')
        plt.ylabel('Value')
        plt.xticks(rotation=45)
        
        plt.tight_layout()
        plt.savefig(f"{output_dir}/fairness_analysis.png", dpi=300, bbox_inches='tight')
        plt.close()
    
    def _generate_text_report(self, output_dir):
        """Generate comprehensive text report"""
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("ADDIS ABABA TRAFFIC LIGHT RL EVALUATION REPORT")
        report_lines.append("=" * 80)
        report_lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"Model: {self.model_path}")
        report_lines.append("")
        
        # Aggregated results
        if 'aggregated' in self.results:
            agg = self.results['aggregated']
            report_lines.append("PERFORMANCE SUMMARY")
            report_lines.append("-" * 40)
            report_lines.append(f"Mean Episode Reward: {agg['mean_reward']:.2f} ± {agg['std_reward']:.2f}")
            report_lines.append(f"Mean Episode Length: {agg['mean_length']:.0f}")
            report_lines.append(f"Mean Throughput: {agg['mean_throughput']:.0f} ± {agg['std_throughput']:.0f}")
            report_lines.append(f"Mean Waiting Time: {agg['mean_waiting_time']:.2f} ± {agg['std_waiting_time']:.2f}")
            report_lines.append(f"Mean Speed: {agg['mean_speed']:.2f} ± {agg['std_speed']:.2f}")
            report_lines.append(f"Reward per Step: {agg['reward_per_step']:.4f}")
            report_lines.append("")
        
        # Baseline comparison
        if 'baseline_comparison' in self.results:
            comp = self.results['baseline_comparison']
            report_lines.append("BASELINE COMPARISON")
            report_lines.append("-" * 40)
            report_lines.append(f"Reward Improvement: {comp['reward_improvement']:.1f}%")
            report_lines.append(f"Waiting Time Reduction: {comp['waiting_time_improvement']:.1f}%")
            report_lines.append(f"Throughput Improvement: {comp['throughput_improvement']:.1f}%")
            report_lines.append("")
            
            report_lines.append("Detailed Comparison:")
            report_lines.append(f"  RL Reward: {comp['rl_reward']:.2f} vs Baseline: {comp['baseline_reward']:.2f}")
            report_lines.append(f"  RL Waiting: {comp['rl_waiting_time']:.2f} vs Baseline: {comp['baseline_waiting_time']:.2f}")
            report_lines.append(f"  RL Throughput: {comp['rl_throughput']:.0f} vs Baseline: {comp['baseline_throughput']:.0f}")
            report_lines.append("")
        
        # Fairness analysis
        if 'fairness' in self.results:
            fair = self.results['fairness']
            report_lines.append("FAIRNESS ANALYSIS")
            report_lines.append("-" * 40)
            report_lines.append(f"Fairness Score: {fair['fairness_score']:.4f} (higher is better)")
            report_lines.append(f"Total Starvation Events: {fair['total_starvation_events']}")
            report_lines.append(f"Average Phase Switches per TLS: {fair['avg_phase_switches']:.1f}")
            report_lines.append("")
        
        # Configuration
        report_lines.append("CONFIGURATION")
        report_lines.append("-" * 40)
        for key, value in self.config.items():
            report_lines.append(f"{key}: {value}")
        
        # Save report
        with open(f"{output_dir}/evaluation_report.txt", 'w') as f:
            f.write('\n'.join(report_lines))
    
    def cleanup(self):
        """Cleanup resources"""
        if self.env:
            self.env.close()


def main():
    parser = argparse.ArgumentParser(description='Evaluate trained traffic light RL model')
    parser.add_argument('--model', required=True, help='Path to trained model')
    parser.add_argument('--episodes', type=int, default=10, help='Number of episodes to evaluate')
    parser.add_argument('--output', default=None, help='Output directory for results')
    parser.add_argument('--gui', action='store_true', help='Use SUMO GUI for visualization')
    parser.add_argument('--config', help='Custom config file (JSON)')
    
    args = parser.parse_args()
    
    # Configuration
    config = {
        'net_file': 'AddisAbaba.net.xml',
        'route_file': 'addisTrafficFullNetwork.rou.xml',
        'sumocfg_file': 'AddisAbabaSimple.sumocfg',
        'use_gui': args.gui,
        'num_seconds': 3600,
        'delta_time': 5,
        'min_green': 10,
        'max_red': 60,
        'yellow_time': 4
    }
    
    # Output directory
    if args.output is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = f"evaluation_results_{timestamp}"
    else:
        output_dir = args.output
    
    print("Addis Ababa Traffic Light RL Model Evaluation")
    print("=" * 50)
    print(f"Model: {args.model}")
    print(f"Episodes: {args.episodes}")
    print(f"Output: {output_dir}")
    print(f"GUI: {args.gui}")
    
    # Create evaluator
    evaluator = ModelEvaluator(args.model, config)
    
    try:
        # Load model and environment
        evaluator.load_model_and_env()
        
        # Run evaluation
        print("\\nRunning evaluation...")
        evaluator.evaluate_multiple_episodes(n_episodes=args.episodes)
        
        # Baseline comparison
        print("\\nRunning baseline comparison...")
        evaluator.evaluate_baseline_comparison(n_episodes=min(5, args.episodes))
        
        # Fairness evaluation
        print("\\nEvaluating fairness metrics...")
        evaluator.evaluate_fairness_metrics()
        
        # Generate report
        evaluator.generate_report(output_dir)
        
        # Print summary
        if 'aggregated' in evaluator.results:
            agg = evaluator.results['aggregated']
            print(f"\\nEVALUATION SUMMARY:")
            print(f"Mean Reward: {agg['mean_reward']:.2f}")
            print(f"Mean Throughput: {agg['mean_throughput']:.0f}")
            print(f"Mean Waiting Time: {agg['mean_waiting_time']:.2f}")
            
        if 'baseline_comparison' in evaluator.results:
            comp = evaluator.results['baseline_comparison']
            print(f"\\nIMPROVEMENT OVER BASELINE:")
            print(f"Reward: {comp['reward_improvement']:.1f}%")
            print(f"Waiting Time: {comp['waiting_time_improvement']:.1f}%")
            print(f"Throughput: {comp['throughput_improvement']:.1f}%")
        
        print(f"\\nDetailed results saved to: {output_dir}")
        
    except Exception as e:
        print(f"Error during evaluation: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        evaluator.cleanup()


if __name__ == "__main__":
    main()