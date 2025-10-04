#!/usr/bin/env python3
"""
Run RL vs SUMO-default baseline across three scenarios with multiple episodes.

Scenarios expected (created by generate_scenarios.py):
- AddisAbabaSimple_offpeak.sumocfg
- AddisAbabaSimple_peak.sumocfg
- AddisAbabaSimple_jitter.sumocfg

Usage:
    py run_scenario_evaluations.py --model <path> --episodes 10 --episode-length 999999
"""

import argparse
import os
import subprocess
from datetime import datetime

SCENARIOS = [
    ("offpeak", "AddisAbabaSimple_offpeak.sumocfg"),
    ("peak", "AddisAbabaSimple_peak.sumocfg"),
    ("jitter", "AddisAbabaSimple_jitter.sumocfg"),
]


def run_eval(model_path: str, sumocfg: str, episodes: int, episode_length: int):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = os.path.join("evaluation_results", f"scenario_{os.path.splitext(os.path.basename(sumocfg))[0]}_{ts}")
    os.makedirs(out_dir, exist_ok=True)

    cmd = [
        "py", "evaluate_targeted_model.py",
        "--model", model_path,
        "--episodes", str(episodes),
        "--episode-length", str(episode_length),
        "--sumocfg", sumocfg,
        "--output-dir", out_dir,
    ]

    print(f"\nRunning evaluation: {sumocfg} -> {out_dir}")
    print(" ", " ".join(cmd))

    # Run without GUI for batch stats
    subprocess.run(cmd, check=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--episodes", type=int, default=10)
    parser.add_argument("--episode-length", type=int, default=999999)
    args = parser.parse_args()

    for name, sumocfg in SCENARIOS:
        if not os.path.exists(sumocfg):
            raise FileNotFoundError(f"Missing scenario sumocfg: {sumocfg}. Run generate_scenarios.py first.")
        run_eval(args.model, sumocfg, args.episodes, args.episode_length)

    print("\n✅ Completed all scenario evaluations.")
