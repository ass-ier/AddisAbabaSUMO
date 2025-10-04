"""
Optimized PPO Training for Targeted Addis Ababa Traffic Lights
============================================================

Fast, efficient training on specific intersections:
- megenagna, abem, salitemihret, shola1, shola2, bolebrass, tikuranbesa

Optimizations:
1. Reduced episode length for faster training
2. Targeted TLS subset for focused learning
3. Optimized hyperparameters for quick convergence
4. Built-in fixed-time baseline comparison
5. Comprehensive model saving and evaluation
"""

import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime
from typing import Dict, List, Tuple
import warnings
import json
warnings.filterwarnings('ignore')

# ML imports
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.vec_env import DummyVecEnv
from stable_baselines3.common.callbacks import BaseCallback, EvalCallback, CallbackList, CheckpointCallback
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.logger import configure
import torch

# Custom environment
from addis_targeted_env import AddisTargetedEnvironment, FixedTimeController

class OptimizedTrainingCallback(BaseCallback):
    """Optimized callback for targeted traffic light training"""
    
    def __init__(self, eval_env, baseline_results: Dict, eval_freq=5000, verbose=1):
        super().__init__(verbose)
        self.eval_env = eval_env
        self.baseline_results = baseline_results
        self.eval_freq = eval_freq
        self.episode_rewards = []
        self.best_mean_reward = -float('inf')
        
    def _on_step(self) -> bool:
        # Log episode metrics if available
        if len(self.locals.get('infos', [])) > 0:
            info = self.locals['infos'][0]
            if 'episode' in info:
                episode_reward = info['episode']['r']
                self.episode_rewards.append(episode_reward)
                
                # Log to tensorboard
                self.logger.record('episode/reward', episode_reward)
                if len(self.episode_rewards) >= 10:
                    recent_mean = np.mean(self.episode_rewards[-10:])
                    self.logger.record('episode/mean_reward_10', recent_mean)
                    
                    # Compare with baseline
                    baseline_reward = self.baseline_results.get('episode_reward', 0)
                    improvement = ((recent_mean - baseline_reward) / abs(baseline_reward) * 100) if baseline_reward != 0 else 0
                    self.logger.record('evaluation/improvement_vs_baseline', improvement)
        
        # Periodic evaluation with comparison
        if self.n_calls % self.eval_freq == 0 and self.n_calls > 0:
            self._evaluate_vs_baseline()
        
        return True
    
    def _evaluate_vs_baseline(self):
        """Evaluate current policy against baseline"""
        if self.verbose > 0:
            print(f"\\n🔍 Evaluating at step {self.n_calls}")
        
        try:
            # Run RL policy evaluation
            obs, info = self.eval_env.reset()
            rl_episode_reward = 0
            rl_waiting_time = 0
            rl_throughput = 0
            step_count = 0
            
            while step_count < 60:  # Limit evaluation steps for speed
                action, _ = self.model.predict(obs, deterministic=True)
                obs, reward, done, truncated, info = self.eval_env.step(action)
                rl_episode_reward += reward
                step_count += 1
                
                if 'total_waiting_time' in info:
                    rl_waiting_time += info['total_waiting_time']
                if 'total_throughput' in info:
                    rl_throughput += info['total_throughput']
                
                if done or truncated:
                    break
            
            # Calculate averages
            rl_avg_waiting = rl_waiting_time / max(step_count, 1)
            rl_avg_throughput = rl_throughput / max(step_count, 1)
            
            # Compare with baseline
            baseline_reward = self.baseline_results.get('episode_reward', 0)
            baseline_waiting = self.baseline_results.get('avg_waiting_per_step', float('inf'))
            baseline_throughput = self.baseline_results.get('avg_throughput_per_step', 0)
            
            reward_improvement = ((rl_episode_reward - baseline_reward) / abs(baseline_reward) * 100) if baseline_reward != 0 else 0
            waiting_improvement = ((baseline_waiting - rl_avg_waiting) / baseline_waiting * 100) if baseline_waiting > 0 else 0
            throughput_improvement = ((rl_avg_throughput - baseline_throughput) / baseline_throughput * 100) if baseline_throughput > 0 else 0
            
            # Log improvements
            self.logger.record('eval/rl_reward', rl_episode_reward)
            self.logger.record('eval/rl_avg_waiting', rl_avg_waiting)
            self.logger.record('eval/rl_avg_throughput', rl_avg_throughput)
            self.logger.record('eval/reward_improvement_pct', reward_improvement)
            self.logger.record('eval/waiting_improvement_pct', waiting_improvement)
            self.logger.record('eval/throughput_improvement_pct', throughput_improvement)
            
            if rl_episode_reward > self.best_mean_reward:
                self.best_mean_reward = rl_episode_reward
                self.logger.record('eval/best_mean_reward', self.best_mean_reward)
            
            if self.verbose > 0:
                print(f"RL Reward: {rl_episode_reward:.2f} (Baseline: {baseline_reward:.2f}) - Improvement: {reward_improvement:+.1f}%")
                print(f"RL Waiting: {rl_avg_waiting:.1f} (Baseline: {baseline_waiting:.1f}) - Improvement: {waiting_improvement:+.1f}%")
                print(f"RL Throughput: {rl_avg_throughput:.1f} (Baseline: {baseline_throughput:.1f}) - Improvement: {throughput_improvement:+.1f}%")
                
        except Exception as e:
            print(f"Error during evaluation: {e}")


def create_targeted_env(use_gui=False, episode_seconds=1200):
    """Create targeted environment"""
    target_tls_ids = ['megenagna', 'abem', 'salitemihret', 'shola1', 'shola2', 'bolebrass', 'tikuranbesa']
    
    env = AddisTargetedEnvironment(
        sumocfg_file="AddisAbabaSimple.sumocfg",
        use_gui=use_gui,
        num_seconds=episode_seconds,  # 20 minutes for efficiency
        delta_time=15,  # 15-second intervals
        target_tls_ids=target_tls_ids
    )
    return Monitor(env)


def run_baseline_evaluation(episodes=3):
    """Run baseline fixed-time evaluation"""
    print("🚦 Running Fixed-Time Baseline Evaluation...")
    
    env = create_targeted_env(use_gui=False, episode_seconds=1200)
    baseline_controller = FixedTimeController(env, green_time=25, yellow_time=4)
    
    results = []
    for episode in range(episodes):
        print(f"  Baseline episode {episode + 1}/{episodes}")
        result = baseline_controller.run_episode()
        results.append(result)
        print(f"    Reward: {result['episode_reward']:.2f}, Waiting: {result['avg_waiting_per_step']:.1f}, Throughput: {result['avg_throughput_per_step']:.1f}")
    
    env.close()
    
    # Calculate average results
    avg_results = {
        'episode_reward': np.mean([r['episode_reward'] for r in results]),
        'total_waiting_time': np.mean([r['total_waiting_time'] for r in results]),
        'total_throughput': np.mean([r['total_throughput'] for r in results]),
        'avg_waiting_per_step': np.mean([r['avg_waiting_per_step'] for r in results]),
        'avg_throughput_per_step': np.mean([r['avg_throughput_per_step'] for r in results]),
        'episodes': episodes,
        'individual_results': results
    }
    
    print(f"✅ Baseline Results:")
    print(f"   Average Reward: {avg_results['episode_reward']:.2f}")
    print(f"   Average Waiting: {avg_results['avg_waiting_per_step']:.1f}")
    print(f"   Average Throughput: {avg_results['avg_throughput_per_step']:.1f}")
    
    return avg_results


def main():
    """Main training function with flexible training options"""
    
    # Parse command line arguments for training mode
    import argparse
    parser = argparse.ArgumentParser(description='Targeted Addis Traffic Light Training')
    parser.add_argument('--mode', choices=['quick', 'standard', 'thorough', 'production'], 
                        default='standard', help='Training mode')
    parser.add_argument('--timesteps', type=int, help='Override timesteps')
    parser.add_argument('--episode-minutes', type=int, default=20, help='Episode length in minutes')
    
    args = parser.parse_args()
    
    # Training mode configurations
    training_modes = {
        'quick': {
            'total_timesteps': 100000,   # ~1,250 episodes - Quick test (15-30 min)
            'description': 'Quick proof-of-concept training',
            'expected_time': '15-30 minutes'
        },
        'standard': {
            'total_timesteps': 300000,   # ~3,750 episodes - Good balance (45-90 min)
            'description': 'Standard training for good performance', 
            'expected_time': '45-90 minutes'
        },
        'thorough': {
            'total_timesteps': 500000,   # ~6,250 episodes - High quality (2-3 hours)
            'description': 'Thorough training for high performance',
            'expected_time': '2-3 hours'
        },
        'production': {
            'total_timesteps': 1000000,  # ~12,500 episodes - Production quality (4-6 hours)
            'description': 'Production-quality training',
            'expected_time': '4-6 hours'
        }
    }
    
    selected_mode = training_modes[args.mode]
    
    # Configuration based on selected mode
    config = {
        'episode_seconds': args.episode_minutes * 60,  # Configurable episode length
        'total_timesteps': args.timesteps if args.timesteps else selected_mode['total_timesteps'],
        'eval_freq': min(10000, selected_mode['total_timesteps'] // 20),  # Adaptive eval frequency
        'n_eval_episodes': 2,        # Quick evaluation
        'save_freq': min(25000, selected_mode['total_timesteps'] // 10),  # Adaptive save frequency
        
        # PPO hyperparameters optimized for targeted TLS
        'learning_rate': 5e-4,       # Slightly higher for faster learning
        'n_steps': 512,              # Smaller for 7 TLS
        'batch_size': 64,            # Good balance
        'n_epochs': 8,               # Reduced for speed
        'gamma': 0.98,               # Slightly lower discount
        'gae_lambda': 0.95,
        'clip_range': 0.2,
        'ent_coef': 0.05,            # Higher exploration for faster convergence
        'vf_coef': 0.5,
        'max_grad_norm': 0.5
    }
    
    # Setup experiment directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    experiment_dir = f"experiments/targeted_addis_ppo_{timestamp}"
    os.makedirs(experiment_dir, exist_ok=True)
    os.makedirs(f"{experiment_dir}/models", exist_ok=True)
    os.makedirs(f"{experiment_dir}/models/checkpoints", exist_ok=True)
    os.makedirs(f"{experiment_dir}/logs", exist_ok=True)
    os.makedirs(f"{experiment_dir}/plots", exist_ok=True)
    
    print(f"🚀 Starting {args.mode.title()} Training: {experiment_dir}")
    print(f"🎯 Target TLS: megenagna, abem, salitemihret, shola1, shola2, bolebrass, tikuranbesa")
    print(f"⚡ Mode: {selected_mode['description']}")
    print(f"📊 Configuration: {config['total_timesteps']:,} timesteps, {config['episode_seconds']/60:.0f}min episodes")
    print(f"⏱️  Expected time: {selected_mode['expected_time']}")
    print(f"💾 Saves every {config['save_freq']:,} steps, evaluates every {config['eval_freq']:,} steps")
    
    # Check GPU
    print(f"\\n🔧 Device Information:")
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        device = 'cuda'
    else:
        print("Using CPU")
        device = 'cpu'
    
    # Run baseline evaluation first
    print("\\n" + "="*60)
    baseline_results = run_baseline_evaluation(episodes=3)
    
    # Save baseline results
    with open(f"{experiment_dir}/baseline_results.json", 'w') as f:
        json.dump(baseline_results, f, indent=2)
    
    # Create environments
    print("\\n" + "="*60)
    print("🌍 Creating Training Environment...")
    
    def make_env():
        return create_targeted_env(use_gui=False, episode_seconds=config['episode_seconds'])
    
    # Single environment for now (can be scaled up later)
    env = DummyVecEnv([make_env])
    
    # Create evaluation environment
    eval_env = create_targeted_env(use_gui=False, episode_seconds=config['episode_seconds'])
    
    print("✅ Environments created!")
    
    # Setup logging
    logger = configure(f"{experiment_dir}/logs", ["stdout", "csv", "tensorboard"])
    
    # Create PPO model with optimized configuration
    print(f"\\n🧠 Creating PPO Model (device: {device})...")
    model = PPO(
        "MlpPolicy",
        env,
        learning_rate=config['learning_rate'],
        n_steps=config['n_steps'],
        batch_size=config['batch_size'],
        n_epochs=config['n_epochs'],
        gamma=config['gamma'],
        gae_lambda=config['gae_lambda'],
        clip_range=config['clip_range'],
        ent_coef=config['ent_coef'],
        vf_coef=config['vf_coef'],
        max_grad_norm=config['max_grad_norm'],
        verbose=1,
        device=device,
        tensorboard_log=f"{experiment_dir}/logs"
    )
    
    model.set_logger(logger)
    print(f"✅ Model created on {model.device}")
    
    # Create callbacks
    training_callback = OptimizedTrainingCallback(
        eval_env=eval_env,
        baseline_results=baseline_results,
        eval_freq=config['eval_freq']
    )
    
    checkpoint_callback = CheckpointCallback(
        save_freq=config['save_freq'],
        save_path=f"{experiment_dir}/models/checkpoints",
        name_prefix="targeted_ppo_checkpoint",
        save_replay_buffer=False,
        save_vecnormalize=False,
        verbose=1
    )
    
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=f"{experiment_dir}/models/best_model",
        log_path=f"{experiment_dir}/logs/eval_logs",
        eval_freq=config['eval_freq'],
        n_eval_episodes=config['n_eval_episodes'],
        deterministic=True,
        render=False
    )
    
    callback_list = CallbackList([training_callback, checkpoint_callback, eval_callback])
    
    # Save training configuration
    config_with_baseline = config.copy()
    config_with_baseline['baseline_results'] = baseline_results
    config_with_baseline['experiment_dir'] = experiment_dir
    config_with_baseline['device'] = device
    config_with_baseline['timestamp'] = timestamp
    
    with open(f"{experiment_dir}/training_config.json", 'w') as f:
        json.dump(config_with_baseline, f, indent=2, default=str)
    
    # Start training
    print("\\n" + "="*60)
    print(f"🚀 Starting PPO Training ({config['total_timesteps']:,} timesteps)...")
    print("📊 Monitor progress:")
    print(f"   TensorBoard: tensorboard --logdir {experiment_dir}/logs")
    print(f"   Logs: {experiment_dir}/logs")
    
    try:
        start_time = datetime.now()
        
        model.learn(
            total_timesteps=config['total_timesteps'],
            callback=callback_list,
            log_interval=10,
            progress_bar=True
        )
        
        end_time = datetime.now()
        training_duration = end_time - start_time
        
        # Save final model with metadata
        final_model_path = f"{experiment_dir}/models/final_model"
        model.save(final_model_path)
        
        model_metadata = {
            'timestamp': timestamp,
            'training_duration_minutes': training_duration.total_seconds() / 60,
            'total_timesteps': config['total_timesteps'],
            'final_model_path': final_model_path,
            'baseline_results': baseline_results,
            'training_config': config,
            'device_used': device,
            'target_tls': ['megenagna', 'abem', 'salitemihret', 'shola1', 'shola2', 'bolebrass', 'tikuranbesa']
        }
        
        with open(f"{experiment_dir}/models/model_metadata.json", 'w') as f:
            json.dump(model_metadata, f, indent=2, default=str)
        
        # Save timestamped model
        model.save(f"{experiment_dir}/models/targeted_addis_final_{timestamp}")
        
        print("\\n" + "="*60)
        print("✅ TRAINING COMPLETED!")
        print(f"⏱️  Training time: {training_duration}")
        print(f"💾 Models saved:")
        print(f"   Final: {final_model_path}.zip")
        print(f"   Best: {experiment_dir}/models/best_model.zip")
        print(f"   Timestamped: targeted_addis_final_{timestamp}.zip")
        print(f"📊 Baseline comparison available in metadata")
        
        # Final evaluation
        print("\\n🎯 Running Final Evaluation...")
        obs, info = eval_env.reset()
        final_reward = 0
        final_waiting = 0
        final_throughput = 0
        steps = 0
        
        while steps < 80:  # Run evaluation
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, done, truncated, info = eval_env.step(action)
            final_reward += reward
            steps += 1
            
            if 'total_waiting_time' in info:
                final_waiting += info['total_waiting_time']
            if 'total_throughput' in info:
                final_throughput += info['total_throughput']
            
            if done or truncated:
                break
        
        final_avg_waiting = final_waiting / max(steps, 1)
        final_avg_throughput = final_throughput / max(steps, 1)
        
        # Calculate improvements
        baseline_reward = baseline_results['episode_reward']
        baseline_waiting = baseline_results['avg_waiting_per_step']
        baseline_throughput = baseline_results['avg_throughput_per_step']
        
        reward_improvement = ((final_reward - baseline_reward) / abs(baseline_reward) * 100) if baseline_reward != 0 else 0
        waiting_improvement = ((baseline_waiting - final_avg_waiting) / baseline_waiting * 100) if baseline_waiting > 0 else 0
        throughput_improvement = ((final_avg_throughput - baseline_throughput) / baseline_throughput * 100) if baseline_throughput > 0 else 0
        
        print("\\n📈 FINAL RESULTS vs BASELINE:")
        print(f"   Reward: {final_reward:.2f} vs {baseline_reward:.2f} ({reward_improvement:+.1f}%)")
        print(f"   Waiting Time: {final_avg_waiting:.1f} vs {baseline_waiting:.1f} ({waiting_improvement:+.1f}%)")
        print(f"   Throughput: {final_avg_throughput:.1f} vs {baseline_throughput:.1f} ({throughput_improvement:+.1f}%)")
        
        # Save final results
        final_results = {
            'final_reward': final_reward,
            'final_avg_waiting': final_avg_waiting,
            'final_avg_throughput': final_avg_throughput,
            'baseline_reward': baseline_reward,
            'baseline_waiting': baseline_waiting,
            'baseline_throughput': baseline_throughput,
            'reward_improvement_pct': reward_improvement,
            'waiting_improvement_pct': waiting_improvement,
            'throughput_improvement_pct': throughput_improvement,
            'training_duration_minutes': training_duration.total_seconds() / 60
        }
        
        with open(f"{experiment_dir}/final_results.json", 'w') as f:
            json.dump(final_results, f, indent=2)
        
        print(f"\\n💾 All results saved in: {experiment_dir}")
        
    except KeyboardInterrupt:
        print("\\n⏹️  Training interrupted by user")
        model.save(f"{experiment_dir}/models/interrupted_model")
        print(f"Model saved to {experiment_dir}/models/interrupted_model.zip")
    
    except Exception as e:
        print(f"\\n❌ Training error: {e}")
        model.save(f"{experiment_dir}/models/error_model")
        print(f"Model saved to {experiment_dir}/models/error_model.zip")
    
    finally:
        env.close()
        eval_env.close()


if __name__ == "__main__":
    main()