"""
Targeted Traffic Light Model Evaluation Script
=============================================

Compare trained RL models against fixed-time baseline on specific intersections:
- megenagna, abem, salitemihret, shola1, shola2, bolebrass, tikuranbesa

Features:
1. Side-by-side comparison (RL vs Fixed-Time)
2. Statistical significance testing
3. Detailed performance metrics
4. Visualization of results
5. Export results for analysis
"""

import argparse
import os
import json
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from typing import Dict, List, Tuple
from stable_baselines3 import PPO
from addis_targeted_env import AddisTargetedEnvironment, FixedTimeController, SumoDefaultController

class ModelEvaluator:
    """Comprehensive evaluation of RL vs Fixed-Time control"""
    
    def __init__(self, model_path: str = None, sumocfg_file: str = "AddisAbabaSimple.sumocfg"):
        self.model_path = model_path
        self.sumocfg_file = sumocfg_file
        self.rl_model = None
        self.target_tls_ids = ['megenagna', 'abem', 'salitemihret', 'shola1', 'shola2', 'bolebrass', 'tikuranbesa']
        
    def load_model(self, model_path: str):
        """Load trained RL model"""
        try:
            print(f"Loading RL model from: {model_path}")
            self.rl_model = PPO.load(model_path)
            self.model_path = model_path
            print("✅ RL model loaded successfully")
            return True
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            return False
    
    def create_evaluation_env(self, use_gui: bool = False, episode_seconds: int = 1800, control_mode: str = 'rl', delta_time: int = 15):
        """Create environment for evaluation"""
        return AddisTargetedEnvironment(
            sumocfg_file=self.sumocfg_file,
            use_gui=use_gui,
            num_seconds=episode_seconds,
            delta_time=delta_time,
            target_tls_ids=self.target_tls_ids,
            control_mode=control_mode
        )
    
    def run_rl_evaluation(self, episodes: int = 5, use_gui: bool = False, episode_seconds: int = 1800, delta_time: int = 15) -> List[Dict]:
        """Run evaluation with RL model"""
        if not self.rl_model:
            raise ValueError("RL model not loaded. Call load_model() first.")
        
        print(f"🤖 Running RL evaluation ({episodes} episodes)...")
        results = []
        
        for episode in range(episodes):
            print(f"  RL Episode {episode + 1}/{episodes}")
            
            env = self.create_evaluation_env(use_gui=use_gui, episode_seconds=episode_seconds, delta_time=delta_time)
            
            obs, info = env.reset()
            episode_reward = 0
            total_waiting = 0
            total_throughput = 0
            step_count = 0
            emergency_switches = 0
            
            while True:
                action, _ = self.rl_model.predict(obs, deterministic=True)
                obs, reward, done, truncated, info = env.step(action)
                
                episode_reward += reward
                step_count += 1
                
                if 'total_waiting_time' in info:
                    total_waiting += info['total_waiting_time']
                if 'total_throughput' in info:
                    total_throughput += info['total_throughput']
                if 'emergency_switches' in info:
                    emergency_switches = info['emergency_switches']
                
                if done or truncated:
                    break
            
            env.close()
            
            result = {
                'episode': episode + 1,
                'episode_reward': episode_reward,
                'total_waiting_time': total_waiting,
                'total_throughput': total_throughput,
                'steps': step_count,
                'avg_waiting_per_step': total_waiting / max(step_count, 1),
                'avg_throughput_per_step': total_throughput / max(step_count, 1),
                'emergency_switches': emergency_switches,
                'simulation_time_minutes': step_count * delta_time / 60
            }
            
            results.append(result)
            print(f"    Reward: {result['episode_reward']:.2f}, "
                  f"Waiting: {result['avg_waiting_per_step']:.1f}, "
                  f"Throughput: {result['avg_throughput_per_step']:.1f}, "
                  f"Emergency: {emergency_switches}")
        
        return results
    
    def run_fixed_time_evaluation(self, episodes: int = 5, use_gui: bool = False, 
                                 episode_seconds: int = 1800, green_time: int = 25, delta_time: int = 15) -> List[Dict]:
        """Run evaluation with fixed-time control"""
        print(f"🚦 Running Fixed-Time evaluation ({episodes} episodes) using SUMO default TLS logic...")
        results = []
        
        for episode in range(episodes):
            print(f"  Fixed-Time Episode {episode + 1}/{episodes}")
            
            env = self.create_evaluation_env(use_gui=use_gui, episode_seconds=episode_seconds, control_mode='sumo_default', delta_time=delta_time)
            controller = SumoDefaultController(env)
            
            result = controller.run_episode()
            result['episode'] = episode + 1
            result['simulation_time_minutes'] = result['steps'] * delta_time / 60
            
            results.append(result)
            print(f"    Reward: {result['episode_reward']:.2f}, "
                  f"Waiting: {result['avg_waiting_per_step']:.1f}, "
                  f"Throughput: {result['avg_throughput_per_step']:.1f}")
        
        return results
    
    def compare_methods(self, rl_results: List[Dict], fixed_results: List[Dict]) -> Dict:
        """Compare RL and Fixed-Time results"""
        print("\\n📊 Calculating comparison metrics...")
        
        # Calculate averages
        rl_avg = {
            'episode_reward': np.mean([r['episode_reward'] for r in rl_results]),
            'avg_waiting_per_step': np.mean([r['avg_waiting_per_step'] for r in rl_results]),
            'avg_throughput_per_step': np.mean([r['avg_throughput_per_step'] for r in rl_results]),
            'emergency_switches': np.mean([r.get('emergency_switches', 0) for r in rl_results])
        }
        
        fixed_avg = {
            'episode_reward': np.mean([r['episode_reward'] for r in fixed_results]),
            'avg_waiting_per_step': np.mean([r['avg_waiting_per_step'] for r in fixed_results]),
            'avg_throughput_per_step': np.mean([r['avg_throughput_per_step'] for r in fixed_results])
        }
        
        # Calculate improvements
        reward_improvement = ((rl_avg['episode_reward'] - fixed_avg['episode_reward']) 
                            / abs(fixed_avg['episode_reward']) * 100) if fixed_avg['episode_reward'] != 0 else 0
        
        waiting_improvement = ((fixed_avg['avg_waiting_per_step'] - rl_avg['avg_waiting_per_step']) 
                             / fixed_avg['avg_waiting_per_step'] * 100) if fixed_avg['avg_waiting_per_step'] > 0 else 0
        
        throughput_improvement = ((rl_avg['avg_throughput_per_step'] - fixed_avg['avg_throughput_per_step']) 
                                / fixed_avg['avg_throughput_per_step'] * 100) if fixed_avg['avg_throughput_per_step'] > 0 else 0
        
        # Statistical significance (simple t-test approximation)
        from scipy import stats
        
        rl_rewards = [r['episode_reward'] for r in rl_results]
        fixed_rewards = [r['episode_reward'] for r in fixed_results]
        
        try:
            t_stat, p_value = stats.ttest_ind(rl_rewards, fixed_rewards)
            is_significant = p_value < 0.05
        except:
            t_stat, p_value, is_significant = 0, 1, False
        
        comparison = {
            'rl_averages': rl_avg,
            'fixed_averages': fixed_avg,
            'improvements': {
                'reward_improvement_pct': reward_improvement,
                'waiting_improvement_pct': waiting_improvement,
                'throughput_improvement_pct': throughput_improvement
            },
            'statistical_test': {
                't_statistic': t_stat,
                'p_value': p_value,
                'is_significant': is_significant
            },
            'summary': {
                'rl_better_reward': rl_avg['episode_reward'] > fixed_avg['episode_reward'],
                'rl_better_waiting': rl_avg['avg_waiting_per_step'] < fixed_avg['avg_waiting_per_step'],
                'rl_better_throughput': rl_avg['avg_throughput_per_step'] > fixed_avg['avg_throughput_per_step']
            }
        }
        
        return comparison
    
    def _to_python(self, obj):
        """Recursively convert numpy types to native Python types for JSON serialization"""
        try:
            import numpy as np  # Local import to avoid hard dependency at module import time
        except Exception:
            np = None
        
        if isinstance(obj, dict):
            return {k: self._to_python(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._to_python(v) for v in obj]
        if np is not None and isinstance(obj, np.generic):
            return obj.item()
        return obj
    
    def generate_report(self, rl_results: List[Dict], fixed_results: List[Dict], 
                       comparison: Dict, output_dir: str):
        """Generate comprehensive evaluation report"""
        print("📝 Generating evaluation report...")
        
        # Create detailed report
        report = {
            'evaluation_info': {
                'timestamp': datetime.now().isoformat(),
                'model_path': self.model_path,
                'target_tls': self.target_tls_ids,
                'episodes_per_method': len(rl_results),
                'episode_duration_minutes': rl_results[0]['simulation_time_minutes'] if rl_results else 0
            },
            'rl_results': rl_results,
            'fixed_time_results': fixed_results,
            'comparison': comparison
        }
        
        # Save detailed JSON report
        with open(f"{output_dir}/evaluation_report.json", 'w') as f:
            json.dump(self._to_python(report), f, indent=2)
        
        # Create summary CSV
        summary_data = []
        
        for result in rl_results:
            summary_data.append({
                'method': 'RL',
                'episode': result['episode'],
                'reward': result['episode_reward'],
                'avg_waiting': result['avg_waiting_per_step'],
                'avg_throughput': result['avg_throughput_per_step'],
                'emergency_switches': result.get('emergency_switches', 0)
            })
        
        for result in fixed_results:
            summary_data.append({
                'method': 'Fixed-Time',
                'episode': result['episode'],
                'reward': result['episode_reward'],
                'avg_waiting': result['avg_waiting_per_step'],
                'avg_throughput': result['avg_throughput_per_step'],
                'emergency_switches': 0  # Fixed-time doesn't have emergency switches
            })
        
        df = pd.DataFrame(summary_data)
        df.to_csv(f"{output_dir}/evaluation_summary.csv", index=False)
        
        # Generate visualizations
        self._create_visualizations(df, comparison, output_dir)
        
        # Print summary to console
        self._print_summary(comparison)
        
        return report
    
    def _create_visualizations(self, df: pd.DataFrame, comparison: Dict, output_dir: str):
        """Create evaluation visualizations"""
        plt.style.use('default')
        
        # Create comparison plots
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle('RL vs Fixed-Time Traffic Control Comparison', fontsize=16, fontweight='bold')
        
        # Reward comparison
        sns.boxplot(data=df, x='method', y='reward', ax=axes[0, 0])
        axes[0, 0].set_title('Episode Rewards')
        axes[0, 0].set_ylabel('Reward')
        
        # Waiting time comparison
        sns.boxplot(data=df, x='method', y='avg_waiting', ax=axes[0, 1])
        axes[0, 1].set_title('Average Waiting Time per Step')
        axes[0, 1].set_ylabel('Waiting Time')
        
        # Throughput comparison
        sns.boxplot(data=df, x='method', y='avg_throughput', ax=axes[1, 0])
        axes[1, 0].set_title('Average Throughput per Step')
        axes[1, 0].set_ylabel('Throughput')
        
        # Improvement percentages
        improvements = comparison['improvements']
        metrics = ['Reward', 'Waiting Time', 'Throughput']
        values = [improvements['reward_improvement_pct'], 
                 improvements['waiting_improvement_pct'],
                 improvements['throughput_improvement_pct']]
        
        colors = ['green' if v > 0 else 'red' for v in values]
        bars = axes[1, 1].bar(metrics, values, color=colors, alpha=0.7)
        axes[1, 1].set_title('RL Improvement over Fixed-Time (%)')
        axes[1, 1].set_ylabel('Improvement (%)')
        axes[1, 1].axhline(y=0, color='black', linestyle='-', alpha=0.3)
        
        # Add value labels on bars
        for bar, value in zip(bars, values):
            height = bar.get_height()
            axes[1, 1].text(bar.get_x() + bar.get_width()/2., height + (1 if height >= 0 else -3),
                           f'{value:.1f}%', ha='center', va='bottom' if height >= 0 else 'top')
        
        plt.tight_layout()
        plt.savefig(f"{output_dir}/comparison_plots.png", dpi=300, bbox_inches='tight')
        plt.close()
        
        # Create detailed time series plot
        plt.figure(figsize=(12, 8))
        
        rl_episodes = [r for r in df.itertuples() if r.method == 'RL']
        fixed_episodes = [r for r in df.itertuples() if r.method == 'Fixed-Time']
        
        plt.subplot(2, 1, 1)
        plt.plot([r.episode for r in rl_episodes], [r.reward for r in rl_episodes], 
                'o-', label='RL', color='blue', markersize=6)
        plt.plot([r.episode for r in fixed_episodes], [r.reward for r in fixed_episodes], 
                's-', label='Fixed-Time', color='red', markersize=6)
        plt.title('Episode Rewards Comparison')
        plt.xlabel('Episode')
        plt.ylabel('Reward')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        plt.subplot(2, 1, 2)
        plt.plot([r.episode for r in rl_episodes], [r.avg_waiting for r in rl_episodes], 
                'o-', label='RL', color='blue', markersize=6)
        plt.plot([r.episode for r in fixed_episodes], [r.avg_waiting for r in fixed_episodes], 
                's-', label='Fixed-Time', color='red', markersize=6)
        plt.title('Average Waiting Time Comparison')
        plt.xlabel('Episode')
        plt.ylabel('Avg Waiting Time per Step')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(f"{output_dir}/time_series_plots.png", dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"📊 Visualizations saved to {output_dir}/")
    
    def _print_summary(self, comparison: Dict):
        """Print evaluation summary to console"""
        print("\\n" + "="*80)
        print("🏆 EVALUATION RESULTS SUMMARY")
        print("="*80)
        
        rl_avg = comparison['rl_averages']
        fixed_avg = comparison['fixed_averages']
        improvements = comparison['improvements']
        
        print(f"\\n📊 PERFORMANCE METRICS:")
        print(f"┌─────────────────┬─────────────┬─────────────┬─────────────┐")
        print(f"│ Metric          │     RL      │ Fixed-Time  │ Improvement │")
        print(f"├─────────────────┼─────────────┼─────────────┼─────────────┤")
        print(f"│ Reward          │ {rl_avg['episode_reward']:10.2f}  │ {fixed_avg['episode_reward']:10.2f}  │ {improvements['reward_improvement_pct']:+10.1f}% │")
        print(f"│ Avg Waiting     │ {rl_avg['avg_waiting_per_step']:10.1f}  │ {fixed_avg['avg_waiting_per_step']:10.1f}  │ {improvements['waiting_improvement_pct']:+10.1f}% │")
        print(f"│ Avg Throughput  │ {rl_avg['avg_throughput_per_step']:10.1f}  │ {fixed_avg['avg_throughput_per_step']:10.1f}  │ {improvements['throughput_improvement_pct']:+10.1f}% │")
        print(f"└─────────────────┴─────────────┴─────────────┴─────────────┘")
        
        # Statistical significance
        stat_test = comparison['statistical_test']
        significance = "✅ Significant" if stat_test['is_significant'] else "❌ Not Significant"
        print(f"\\n🔬 STATISTICAL SIGNIFICANCE: {significance} (p={stat_test['p_value']:.4f})")
        
        # Overall assessment
        summary = comparison['summary']
        rl_wins = sum([summary['rl_better_reward'], summary['rl_better_waiting'], summary['rl_better_throughput']])
        
        print(f"\\n🎯 OVERALL ASSESSMENT:")
        print(f"   RL wins in {rl_wins}/3 metrics")
        
        if rl_wins >= 2:
            print("   🏆 RL control outperforms fixed-time control!")
        elif rl_wins == 1:
            print("   🤝 Mixed results - RL shows promise but needs improvement")
        else:
            print("   📈 RL needs further training to match fixed-time performance")
        
        print(f"\\n💡 Emergency switches (RL only): {rl_avg['emergency_switches']:.1f} per episode")


def main():
    parser = argparse.ArgumentParser(description='Evaluate targeted traffic light models')
    parser.add_argument('--model', required=True, help='Path to trained RL model (without .zip)')
    parser.add_argument('--episodes', type=int, default=5, help='Episodes per method')
    parser.add_argument('--gui', action='store_true', help='Show SUMO GUI during evaluation')
    parser.add_argument('--episode-length', type=int, default=1800, help='Episode length in seconds')
    parser.add_argument('--delta-time', type=int, default=60, help='Seconds advanced per RL decision (larger is faster, e.g., 60)')
    parser.add_argument('--fixed-green-time', type=int, default=25, help='Fixed-time green duration')
    parser.add_argument('--output-dir', help='Output directory for results')
    parser.add_argument('--sumocfg', default='AddisAbabaSimple.sumocfg', help='SUMO config file to use for this evaluation')
    
    args = parser.parse_args()
    
    # Setup output directory
    if args.output_dir:
        output_dir = args.output_dir
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = f"evaluation_results/targeted_evaluation_{timestamp}"
    
    os.makedirs(output_dir, exist_ok=True)
    
    print("🚦 Targeted Traffic Light Model Evaluation")
    print("=" * 50)
    print(f"Model: {args.model}")
    print(f"Episodes per method: {args.episodes}")
    print(f"Episode length: {args.episode_length/60:.1f} minutes, decision interval: {args.delta_time}s")
    print(f"Fixed-time green: {args.fixed_green_time} seconds")
    print(f"Results will be saved to: {output_dir}")
    print()
    
    # Initialize evaluator
    evaluator = ModelEvaluator(sumocfg_file=args.sumocfg)
    
    # Load model
    if not evaluator.load_model(args.model):
        return
    
    try:
        # Run RL evaluation
        rl_results = evaluator.run_rl_evaluation(
            episodes=args.episodes,
            use_gui=args.gui,
            episode_seconds=args.episode_length,
            delta_time=args.delta_time
        )
        
        # Run Fixed-Time evaluation
        fixed_results = evaluator.run_fixed_time_evaluation(
            episodes=args.episodes,
            use_gui=args.gui,
            episode_seconds=args.episode_length,
            green_time=args.fixed_green_time,
            delta_time=args.delta_time
        )
        
        # Compare methods
        comparison = evaluator.compare_methods(rl_results, fixed_results)
        
        # Generate report
        report = evaluator.generate_report(rl_results, fixed_results, comparison, output_dir)
        
        print(f"\\n✅ Evaluation completed! Results saved to: {output_dir}")
        print(f"📊 View plots: {output_dir}/comparison_plots.png")
        print(f"📝 Full report: {output_dir}/evaluation_report.json")
        
    except Exception as e:
        print(f"❌ Evaluation error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()