#!/usr/bin/env python3
"""
Summarize multi-scenario evaluation results.

Looks for folders under ./evaluation_results that match 'scenario_*' and reads
'evaluation_report.json' from each. Produces:
- A per-scenario CSV with RL/Fixed means, improvements, p-values
- An overall CSV aggregating across all scenarios/episodes (concatenated rewards)
- Console summary
"""

import os
import json
import math
import glob
import numpy as np
import pandas as pd
from scipy import stats

RESULTS_ROOT = "evaluation_results"


def load_reports():
    paths = sorted(glob.glob(os.path.join(RESULTS_ROOT, "scenario_*", "evaluation_report.json")))
    reports = []
    for p in paths:
        try:
            with open(p, "r") as f:
                data = json.load(f)
            reports.append((p, data))
        except Exception as e:
            print(f"Warning: failed to read {p}: {e}")
    return reports


def extract_metrics(report):
    comp = report.get("comparison", {})
    rl_avg = comp.get("rl_averages", {})
    fx_avg = comp.get("fixed_averages", {})
    improv = comp.get("improvements", {})
    stat = comp.get("statistical_test", {})

    # Pull raw episodes if available
    rl_eps = report.get("rl_results", [])
    fx_eps = report.get("fixed_time_results", [])
    rl_rewards = [ep.get("episode_reward", 0.0) for ep in rl_eps]
    fx_rewards = [ep.get("episode_reward", 0.0) for ep in fx_eps]

    return {
        "rl_reward_mean": float(rl_avg.get("episode_reward", 0.0)),
        "fx_reward_mean": float(fx_avg.get("episode_reward", 0.0)),
        "rl_wait_mean": float(rl_avg.get("avg_waiting_per_step", 0.0)),
        "fx_wait_mean": float(fx_avg.get("avg_waiting_per_step", 0.0)),
        "rl_thr_mean": float(rl_avg.get("avg_throughput_per_step", 0.0)),
        "fx_thr_mean": float(fx_avg.get("avg_throughput_per_step", 0.0)),
        "imp_reward_pct": float(improv.get("reward_improvement_pct", 0.0)),
        "imp_wait_pct": float(improv.get("waiting_improvement_pct", 0.0)),
        "imp_thr_pct": float(improv.get("throughput_improvement_pct", 0.0)),
        "t_stat": float(stat.get("t_statistic", 0.0)) if not math.isnan(stat.get("t_statistic", 0.0)) else float("nan"),
        "p_value": float(stat.get("p_value", 1.0)) if not math.isnan(stat.get("p_value", 1.0)) else float("nan"),
        "rl_rewards": rl_rewards,
        "fx_rewards": fx_rewards,
    }


def main():
    reports = load_reports()
    if not reports:
        print("No scenario evaluation reports found under ./evaluation_results/scenario_*/evaluation_report.json")
        return

    rows = []
    all_rl_rewards = []
    all_fx_rewards = []

    for path, rep in reports:
        scenario = os.path.basename(os.path.dirname(path))  # scenario_<name>_<timestamp>
        metrics = extract_metrics(rep)
        rows.append({
            "scenario": scenario,
            **{k: v for k, v in metrics.items() if not k.endswith("_rewards")}
        })
        all_rl_rewards.extend(metrics["rl_rewards"])
        all_fx_rewards.extend(metrics["fx_rewards"])

    df = pd.DataFrame(rows)
    os.makedirs(os.path.join(RESULTS_ROOT, "summary"), exist_ok=True)
    per_scenario_csv = os.path.join(RESULTS_ROOT, "summary", "per_scenario_summary.csv")
    df.to_csv(per_scenario_csv, index=False)

    # Overall statistics across all scenarios
    overall = {}
    if len(all_rl_rewards) > 1 and len(all_fx_rewards) > 1:
        try:
            t_stat, p_val = stats.ttest_ind(all_rl_rewards, all_fx_rewards, equal_var=False)
        except Exception:
            t_stat, p_val = float("nan"), float("nan")
        overall = {
            "overall_rl_mean": float(np.mean(all_rl_rewards)) if all_rl_rewards else float("nan"),
            "overall_rl_std": float(np.std(all_rl_rewards, ddof=1)) if len(all_rl_rewards) > 1 else float("nan"),
            "overall_fx_mean": float(np.mean(all_fx_rewards)) if all_fx_rewards else float("nan"),
            "overall_fx_std": float(np.std(all_fx_rewards, ddof=1)) if len(all_fx_rewards) > 1 else float("nan"),
            "overall_t_stat": float(t_stat),
            "overall_p_value": float(p_val),
            "n_rl": len(all_rl_rewards),
            "n_fx": len(all_fx_rewards),
        }

    overall_json = os.path.join(RESULTS_ROOT, "summary", "overall_summary.json")
    with open(overall_json, "w") as f:
        json.dump({
            "per_scenario": df.to_dict(orient="records"),
            "overall": overall,
        }, f, indent=2)

    print("\nPer-scenario summary saved:", per_scenario_csv)
    print("Overall summary saved:", overall_json)
    
    # Console snippet
    if overall:
        print("\nOverall reward means (RL vs Fixed):",
              f"{overall['overall_rl_mean']:.2f} ± {overall['overall_rl_std']:.2f}",
              "vs",
              f"{overall['overall_fx_mean']:.2f} ± {overall['overall_fx_std']:.2f}")
        print(f"Overall t-test p-value: {overall['overall_p_value']:.4g} (n_rl={overall['n_rl']}, n_fx={overall['n_fx']})")


if __name__ == "__main__":
    main()
