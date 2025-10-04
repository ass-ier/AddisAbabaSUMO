# Addis Ababa Traffic Light RL (Targeted PPO)

A targeted reinforcement learning system that controls a selected set of key traffic light intersections in the Addis Ababa network using SUMO + Stable-Baselines3 (PPO). This repository includes training, evaluation (GUI and headless), multi-scenario batch runs, and result summarization.


## Tech stack
- SUMO 1.24.0 (TraCI)
- Python 3.x (Windows PowerShell compatible)
- PyTorch (backend for Stable-Baselines3)
- Stable-Baselines3 (PPO)
- Gymnasium
- NumPy, SciPy
- Pandas
- Matplotlib, Seaborn


## Key files and directories
- SUMO assets
  - `AddisAbaba.net.xml` — network with built-in traffic light programs (baseline logic)
  - `AddisAbabaSimple.sumocfg` — base simulation config (net + routes + additional files)
  - Scenario configs (generated):
    - `AddisAbabaSimple_offpeak.sumocfg`
    - `AddisAbabaSimple_peak.sumocfg`
    - `AddisAbabaSimple_jitter.sumocfg`
  - Route files:
    - `addisTrafficFullNetwork.rou.xml` (base)
    - `addisTrafficFullNetwork_offpeak.rou.xml`
    - `addisTrafficFullNetwork_peak.rou.xml`
    - `addisTrafficFullNetwork_jitter.rou.xml`
  - Additional:
    - `vehicleTypesFixed.add.xml`
    - `detectors.add.xml`

- RL environments
  - `addis_targeted_env.py`
    - `AddisTargetedEnvironment` (observation dim 607)
    - `control_mode`: `rl` (agent controls) or `sumo_default` (SUMO baseline)
    - `FixedTimeController` (time-based switch baseline)
    - `SumoDefaultController` (uses SUMO’s built-in TL logic)
  - `addis_traffic_env.py`, `addis_traffic_env_fixed.py` (general variants; not required for targeted PPO)

- Training
  - `train_targeted_ppo.py` — trains PPO on the targeted 7 intersections
  - Artifacts:
    - `experiments/targeted_addis_ppo_YYYYMMDD_HHMMSS/models/best_model/best_model.zip`
    - `experiments/targeted_addis_ppo_YYYYMMDD_HHMMSS/training_config.json`

- Evaluation
  - `evaluate_targeted_model.py` — evaluates a trained model vs SUMO-default baseline
  - Batch/scenario tools:
    - `generate_scenarios.py` — creates offpeak/peak/jitter route/sumocfg variants
    - `run_scenario_evaluations.py` — batch runner across scenarios (headless)
    - `summarize_evaluation_results.py` — per-scenario and overall stats aggregation
  - Outputs:
    - `evaluation_results/<run>/evaluation_report.json`
    - `evaluation_results/<run>/evaluation_summary.csv`
    - `evaluation_results/<run>/comparison_plots.png`, `time_series_plots.png`


## Targeted RL method
- Algorithm: PPO (Stable-Baselines3 `PPO("MlpPolicy", ...)`)
- Environment: `AddisTargetedEnvironment` over 7 key TLS IDs:
  - `megenagna, abem, salitemihret, shola1, shola2, bolebrass, tikuranbesa`
- Observation (607-dim): per-TLS state + capped lane metrics + global metrics.
- Action: per-TLS keep/switch (MultiDiscrete 2^7).
- Reward (shaping): reduces waiting and queue; rewards throughput and speed; includes small switching and fairness terms. See `addis_targeted_env.py`.
- Baseline: SUMO default traffic light programs (from `AddisAbaba.net.xml`) via `SumoDefaultController`.


## Setup
1) Install SUMO and set `SUMO_HOME` environment variable
   - Ensure `sumo` and `sumo-gui` are on PATH.

2) Python dependencies (example)
   ```powershell
   py -m pip install --upgrade pip
   py -m pip install stable-baselines3 gymnasium numpy pandas matplotlib seaborn scipy torch
   ```
   Note: TraCI Python tools ship with SUMO and are picked up via `SUMO_HOME/tools`.


## Training (Targeted PPO)
- Standard training (saves artifacts under a timestamped `experiments/` folder):
  ```powershell
  py train_targeted_ppo.py --mode standard
  ```
  - Best model: `experiments/targeted_addis_ppo_YYYYMMDD_HHMMSS/models/best_model/best_model.zip`
  - Final model: `experiments/targeted_addis_ppo_YYYYMMDD_HHMMSS/models/final_model.zip`
  - Config/results: `training_config.json`, `final_results.json`


## Evaluation (GUI — single episode)
Use the trained targeted model and visualize the simulation in SUMO GUI. This runs both RL and the SUMO-default baseline and saves a report.

```powershell
py evaluate_targeted_model.py --model "experiments/targeted_addis_ppo_<TIMESTAMP>/models/best_model/best_model" --episodes 1 --gui --episode-length 999999
```

- `--episodes 1`: one episode per method (RL and baseline)
- `--gui`: opens SUMO GUI for visual inspection
- `--episode-length 999999`: effectively “until traffic finishes”; the sim ends earlier when no vehicles remain
- Results: `evaluation_results/<timestamped_run>/...`

Optional flags:
- `--sumocfg AddisAbabaSimple.sumocfg` to choose a specific scenario config
- `--delta-time 15` to match training decision interval (default may be higher in your evaluator)


## Optional: Multi-scenario batch evaluation (headless)
Generate scenario variants and run multiple episodes per scenario (no GUI), then summarize.

1) Generate scenarios
```powershell
py generate_scenarios.py
```

2) Run batch evaluations (example: 10 episodes, end at 2 hours)
```powershell
py run_scenario_evaluations.py --model "experiments/targeted_addis_ppo_<TIMESTAMP>/models/best_model/best_model" --episodes 10 --episode-length 7200
```

3) Summarize results across scenarios
```powershell
py summarize_evaluation_results.py
```
- Outputs:
  - `evaluation_results/summary/per_scenario_summary.csv`
  - `evaluation_results/summary/overall_summary.json`


## Tips for speed and fidelity
- GUI vs headless: omit `--gui` for batches (much faster)
- Decision interval: smaller `--delta-time` (e.g., 15s) matches training; larger values (e.g., 60s) run faster but may degrade policy performance
- Episode end: use `--episode-length 7200` to align with `AddisAbabaSimple.sumocfg` end time, or a large number (999999) to let SUMO stop when demand ends
- SUMO routing: dynamic rerouting can be costly; set it lower or 0 in scenario configs for faster batch runs if desired


## Troubleshooting
- “Python was not found”: use `py ...` on Windows, or ensure Python is in PATH
- “Please declare environment variable 'SUMO_HOME'”: set `SUMO_HOME` to SUMO install dir (so `tools/` is accessible)
- “tcpip::Socket::recvAndCheck @ recv: peer shutdown”: Python process crashed (often due to observation/action mismatch). Ensure you evaluate a model trained for `AddisTargetedEnvironment` (obs=607) with the same environment
- Observation shape mismatch (e.g., expected 72 vs got 607): points to wrong model or wrong env; use the targeted model path above


## Reproducibility
- Record:
  - Model path used (e.g., best_model from `experiments/targeted_addis_ppo_20251003_031746`)
  - SUMO version (logs show 1.24.0)
  - Scenario sumocfg and route files
  - Evaluator flags: `--episodes`, `--episode-length`, `--delta-time`, `--sumocfg`


## License / Acknowledgements
- SUMO: DLR (https://www.eclipse.org/sumo/)
- Stable-Baselines3: DLR-RM
- This repository integrates SUMO (TraCI) with SB3 PPO for targeted TLS control in Addis Ababa.
