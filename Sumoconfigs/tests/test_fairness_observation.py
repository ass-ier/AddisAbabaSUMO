import sys
import types
import importlib
import numpy as np

# Fake sumo_rl ObservationFunction base
spaces_mod = types.ModuleType('gym.spaces')
class Box:
    def __init__(self, low, high, shape):
        self.low = low; self.high = high; self.shape = shape
spaces_mod.Box = Box
sys.modules['gym.spaces'] = spaces_mod

# Build a minimal ts object used by FairnessObservationFunction
class TS:
    def __init__(self):
        self.num_green_phases = 4
        self.num_phases = 6
        self.lanes = [0,1,2,3]
        self.green_phase = 0
        self.time_since_last_phase_change = 0
        self.min_green = 5
    def get_lanes_density(self):
        return [0.1, 0.2, 0.0, 0.5]
    def get_lanes_queue(self):
        return [0, 1, 0, 2]

mod = importlib.import_module('fairness_observation')


def test_observation_shape_includes_expected_features():
    fn = mod.FairnessObservationFunction(TS())
    obs = fn()
    # phase one-hot (6) + min-green(1) + density(4) + queue(4) + usage(4) + stagnation(1) = 20
    assert len(obs) == 20


def test_phase_usage_updates_and_stagnation():
    ts = TS()
    fn = mod.FairnessObservationFunction(ts)
    # First call at phase 0
    _ = fn()
    assert fn.phase_usage[0] == 1
    # Advance staying on same phase
    ts.time_since_last_phase_change = 10
    _ = fn()
    assert fn.same_phase_count >= 1