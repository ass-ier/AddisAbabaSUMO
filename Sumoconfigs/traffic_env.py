import gymnasium as gym
from gymnasium import spaces
import numpy as np
import traci

class SumoTrafficEnv(gym.Env):
    """
    SUMO Traffic Environment controlling all traffic lights simultaneously.
    Observation: queue length per lane (concatenated across all TLS)
    Action: discrete phase per TLS (MultiDiscrete)
    Reward: negative total queue length (minimize congestion)
    """

    def __init__(self, sumo_cfg):
        super().__init__()
        self.sumo_cfg = sumo_cfg
        self.connected = False

        # Discover TLS IDs
        self.tls_ids = self._discover_tls()
        print(f"Controlling {len(self.tls_ids)} TLS: {self.tls_ids}")

        # Cache lane IDs and number of phases
        self.lane_ids_per_tls = {}
        self.num_phases = {}

        # Bootstrap spaces
        self._bootstrap_spaces()

    def _discover_tls(self):
        """Run a short SUMO session to discover all traffic lights."""
        try:
            traci.start(["sumo", "-c", self.sumo_cfg, "--no-step-log", "--no-warnings"])
            tls_ids = traci.trafficlight.getIDList()
            traci.close()
            return tls_ids
        except Exception as e:
            print(f"Error discovering TLS: {e}")
            return []

    def _bootstrap_spaces(self):
        """Determine number of phases and lanes per TLS, and define action/observation spaces."""
        try:
            traci.start(["sumo", "-c", self.sumo_cfg, "--no-step-log", "--no-warnings"])
            for tls in self.tls_ids:
                # Phases
                logics = traci.trafficlight.getAllProgramLogics(tls)
                self.num_phases[tls] = len(logics[0].phases) if logics else 1

                # Controlled lanes
                controlled = traci.trafficlight.getControlledLanes(tls)
                seen = set()
                self.lane_ids_per_tls[tls] = [l for l in controlled if not (l in seen or seen.add(l))]

            traci.close()
        except Exception as e:
            print(f"Warning: bootstrap failed: {e}")
            for tls in self.tls_ids:
                self.num_phases[tls] = 1
                self.lane_ids_per_tls[tls] = []

        # Observation: total number of lanes across all TLS
        total_lanes = sum(len(lanes) for lanes in self.lane_ids_per_tls.values())
        self.observation_space = spaces.Box(low=0, high=100, shape=(total_lanes,), dtype=np.float32)

        # Action: MultiDiscrete, one per TLS
        self.action_space = spaces.MultiDiscrete([self.num_phases[tls] for tls in self.tls_ids])

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)

        if self.connected:
            traci.close()
            self.connected = False

        try:
            traci.start(["sumo", "-c", self.sumo_cfg, "--no-step-log", "--no-warnings"])
            self.connected = True
            return self._get_state(), {}
        except Exception as e:
            print(f"Error starting SUMO: {e}")
            return np.zeros(self.observation_space.shape, dtype=np.float32), {}

    def step(self, action):
        if not self.connected:
            return (np.zeros(self.observation_space.shape, dtype=np.float32),
                    0, True, False, {})

        try:
            # Set phase for each TLS
            for tls, phase in zip(self.tls_ids, action):
                traci.trafficlight.setPhase(tls, int(phase))

            # Advance SUMO simulation
            for _ in range(10):
                traci.simulationStep()

            obs = self._get_state()
            reward = self._calculate_reward()
            done = traci.simulation.getMinExpectedNumber() == 0

            return obs, reward, done, False, {}
        except Exception as e:
            print(f"Error in step: {e}")
            return (np.zeros(self.observation_space.shape, dtype=np.float32),
                    0, True, False, {})

    def _get_state(self):
        if not self.connected:
            return np.zeros(self.observation_space.shape, dtype=np.float32)

        states = []
        for tls in self.tls_ids:
            lane_ids = self.lane_ids_per_tls.get(tls, [])
            states.extend([traci.lane.getLastStepVehicleNumber(l) for l in lane_ids])
        return np.array(states, dtype=np.float32)

    def _calculate_reward(self):
        if not self.connected:
            return 0
        total_queue = sum(
            sum(traci.lane.getLastStepVehicleNumber(l) for l in self.lane_ids_per_tls.get(tls, []))
            for tls in self.tls_ids
        )
        return -total_queue  # Minimize congestion

    def close(self):
        if self.connected:
            traci.close()
            self.connected = False