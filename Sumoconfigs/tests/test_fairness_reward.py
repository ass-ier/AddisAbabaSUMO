import sys
import types
import importlib

# Create a fake sumo_rl.environment.traffic_signal module for import
sumo_rl = types.ModuleType('sumo_rl')
env_mod = types.ModuleType('sumo_rl.environment')
traffic_signal_mod = types.ModuleType('sumo_rl.environment.traffic_signal')

class DummyTrafficSignal:
    # Minimal API used by fairness_combined_reward
    def __init__(self):
        self.lanes = list(range(4))
        self.is_yellow = False
        self.num_green_phases = 4
        class ObsFn:
            step_count = 101
            same_phase_count = 0
            phase_usage = {0: 50, 1: 30, 2: 20, 3: 0}
        self.observation_fn = ObsFn()
        class Sumo:
            class Simulation:
                @staticmethod
                def getDepartedNumber():
                    return 4
            simulation = Simulation()
        self.sumo = Sumo()
    def get_total_queued(self):
        return 10
    def get_accumulated_waiting_time_per_lane(self):
        return [5, 10, 0, 15]

    @staticmethod
    def register_reward_fn(fn):
        # No-op for tests
        DummyTrafficSignal._registered = fn

traffic_signal_mod.TrafficSignal = DummyTrafficSignal

sys.modules['sumo_rl'] = sumo_rl
sys.modules['sumo_rl.environment'] = env_mod
sys.modules['sumo_rl.environment.traffic_signal'] = traffic_signal_mod

# Now import the module under test
fr = importlib.import_module('fairness_reward')


def test_fairness_combined_reward_returns_float():
    ts = DummyTrafficSignal()
    r = fr.fairness_combined_reward(ts)
    assert isinstance(r, float)
    # Basic sanity: reward should be between -1 and 1 due to weights
    assert -1.0 <= r <= 1.0


def test_fairness_register_called():
    # Ensure register function executed on import
    assert hasattr(DummyTrafficSignal, '_registered')
    assert callable(DummyTrafficSignal._registered)