# Step 1: Add modules to provide access to specific libraries and functions
import os  # Module provides functions to handle file paths, directories, environment variables
import sys  # Module provides access to Python-specific system parameters and functions
import random
import numpy as np
import matplotlib.pyplot as plt  # Visualization

# Step 1.1: (Additional) Imports for Deep Q-Learning
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

# Step 2: Establish path to SUMO (SUMO_HOME)
if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(tools)
else:
    sys.exit("Please declare environment variable 'SUMO_HOME'")

# Step 3: Add Traci module to provide access to specific libraries and functions
import traci  # Static network information (such as reading and analyzing network files)

# Step 4: Define Sumo configuration
Sumo_config = [
    'sumo',
    '-c', 'RL.sumocfg',
    '--step-length', '0.10',
    '--delay', '1000',
    '--lateral-resolution', '0'
]

# Step 5: Open connection between SUMO and Traci
traci.start(Sumo_config)
#traci.gui.setSchema("View #0", "real world")

# -------------------------
# Step 6: Define Variables
# -------------------------

# ---- Dynamic Traffic Light Configuration ----
class TrafficLightManager:
    def __init__(self):
        self.traffic_lights = {}  # {tls_id: {'detectors': [], 'phases': [], 'last_switch': -MIN_GREEN_STEPS}}
        self.detector_mapping = {}  # {detector_id: tls_id}
        self.state_size = 0
        self.action_size = 2  # 0 = keep phase, 1 = switch phase
        self.detect_traffic_lights()
        self.detect_detectors()
        self.calculate_state_size()
        
    def detect_traffic_lights(self):
        """Automatically detect all traffic lights in the network"""
        all_tls = traci.trafficlight.getIDList()
        print(f"Detected {len(all_tls)} traffic lights: {all_tls}")
        
        for tls_id in all_tls:
            # Get traffic light program info
            programs = traci.trafficlight.getAllProgramLogics(tls_id)
            if programs:
                program = programs[0]  # Use first program
                phases = program.phases
                self.traffic_lights[tls_id] = {
                    'detectors': [],
                    'phases': phases,
                    'last_switch': -MIN_GREEN_STEPS,
                    'current_phase': 0
                }
                print(f"Traffic light {tls_id}: {len(phases)} phases")
    
    def detect_detectors(self):
        """Automatically detect all lane area detectors and map them to traffic lights"""
        all_detectors = traci.lanearea.getIDList()
        print(f"Detected {len(all_detectors)} detectors: {all_detectors}")
        
        for detector_id in all_detectors:
            # Try multiple mapping strategies
            tls_id = self.map_detector_to_tls(detector_id)
            if tls_id:
                if tls_id not in self.traffic_lights:
                    self.traffic_lights[tls_id] = {
                        'detectors': [],
                        'phases': [],
                        'last_switch': -MIN_GREEN_STEPS,
                        'current_phase': 0
                    }
                self.traffic_lights[tls_id]['detectors'].append(detector_id)
                self.detector_mapping[detector_id] = tls_id
                print(f"Mapped detector {detector_id} to traffic light {tls_id}")
            else:
                print(f"Warning: Could not map detector {detector_id} to any traffic light")
    
    def map_detector_to_tls(self, detector_id):
        """Map detector ID to traffic light ID using multiple strategies"""
        # Strategy 1: Direct naming convention (NodeX_Y_Z)
        import re
        match = re.search(r'Node(\d+)', detector_id)
        if match:
            node_num = match.group(1)
            tls_id = f"Node{node_num}"
            if tls_id in traci.trafficlight.getIDList():
                return tls_id
        
        # Strategy 2: Check if detector is near any traffic light using controlled links
        try:
            # Get the lane this detector is on
            lane_id = traci.lanearea.getLaneID(detector_id)
            if lane_id:
                # Find which traffic light controls this lane
                for tls_id in traci.trafficlight.getIDList():
                    controlled_links = traci.trafficlight.getControlledLinks(tls_id)
                    for link in controlled_links:
                        if lane_id in [link[0], link[1]]:  # Check if lane is in controlled links
                            return tls_id
        except:
            pass
        
        # Strategy 3: Check if detector name contains traffic light ID
        for tls_id in traci.trafficlight.getIDList():
            if tls_id.lower() in detector_id.lower():
                return tls_id
        
        return None
    
    def calculate_state_size(self):
        """Calculate total state size based on all detectors and traffic lights"""
        total_detectors = sum(len(tls_info['detectors']) for tls_info in self.traffic_lights.values())
        total_tls = len(self.traffic_lights)
        self.state_size = total_detectors + total_tls  # detectors + current phases
        print(f"State size: {self.state_size} (detectors: {total_detectors}, traffic lights: {total_tls})")
    
    def get_state(self):
        """Get current state for all traffic lights and their detectors"""
        state = []
        
        # Add detector queue lengths
        for tls_id, tls_info in self.traffic_lights.items():
            for detector_id in tls_info['detectors']:
                queue_length = get_queue_length(detector_id)
                state.append(queue_length)
        
        # Add current phases for all traffic lights
        for tls_id in self.traffic_lights.keys():
            current_phase = get_current_phase(tls_id)
            state.append(current_phase)
        
        return tuple(state)
    
    def get_tls_state_slice(self, tls_id):
        """Get state slice specific to a traffic light (for per-TLS decision making)"""
        if tls_id not in self.traffic_lights:
            return None
        
        state = []
        
        # Add queue lengths for detectors controlled by this TLS
        for detector_id in self.traffic_lights[tls_id]['detectors']:
            queue_length = get_queue_length(detector_id)
            state.append(queue_length)
        
        # Add current phase for this traffic light
        current_phase = get_current_phase(tls_id)
        state.append(current_phase)
        
        return tuple(state)
    
    def apply_action(self, action, tls_id):
        """Apply action to specific traffic light"""
        if tls_id not in self.traffic_lights:
            return
        
        if action == 0:  # Keep current phase
            return
        elif action == 1:  # Switch phase
            # Check if minimum green time has passed
            if current_simulation_step - self.traffic_lights[tls_id]['last_switch'] >= MIN_GREEN_STEPS:
                phases = self.traffic_lights[tls_id]['phases']
                if phases:
                    current_phase = get_current_phase(tls_id)
                    next_phase = (current_phase + 1) % len(phases)
                    traci.trafficlight.setPhase(tls_id, next_phase)
                    self.traffic_lights[tls_id]['last_switch'] = current_simulation_step
                    print(f"Switched {tls_id} from phase {current_phase} to {next_phase}")
    
    def get_reward(self, state):
        """Calculate reward based on total queue length across all detectors"""
        # Sum all detector values (exclude phase values)
        total_detectors = sum(len(tls_info['detectors']) for tls_info in self.traffic_lights.values())
        detector_values = state[:total_detectors]
        total_queue = sum(detector_values)
        return -float(total_queue)  # Negative reward to minimize queues

# Initialize traffic light manager
tlm = TrafficLightManager()

# ---- Reinforcement Learning Hyperparameters ----
TOTAL_STEPS = 10000    # The total number of simulation steps for continuous (online) training.

ALPHA = 0.1            # Learning rate (α) between[0, 1]
GAMMA = 0.9            # Discount factor (γ) between[0, 1]
EPSILON = 0.1          # Exploration rate (ε) between[0, 1]

ACTIONS = [0, 1]       # The discrete action space (0 = keep phase, 1 = switch phase)

# ---- Additional Stability Parameters ----
MIN_GREEN_STEPS = 100

# -------------------------
# Step 7: Define Functions
# -------------------------

def build_model(state_size, action_size):
    """
    Build a simple feedforward neural network that approximates Q-values.
    """
    model = keras.Sequential()
    model.add(layers.Input(shape=(state_size,)))
    model.add(layers.Dense(64, activation='relu'))  # Increased size for larger state space
    model.add(layers.Dense(64, activation='relu'))
    model.add(layers.Dense(32, activation='relu'))
    model.add(layers.Dense(action_size, activation='linear'))
    model.compile(
        loss='mse',
        optimizer=keras.optimizers.Adam(learning_rate=0.001)
    )
    return model

def to_array(state_tuple):
    """
    Convert the state tuple into a NumPy array for neural network input.
    """
    return np.array(state_tuple, dtype=np.float32).reshape((1, -1))

# Create the DQN model with dynamic state size
dqn_model = build_model(tlm.state_size, tlm.action_size)

def get_max_Q_value_of_state(s):
    state_array = to_array(s)
    Q_values = dqn_model.predict(state_array, verbose=0)[0]
    return np.max(Q_values)

def get_state():
    """Get current state using traffic light manager"""
    return tlm.get_state()

def apply_action(action, tls_id):
    """Apply action to traffic light using traffic light manager"""
    tlm.apply_action(action, tls_id)

def update_Q_table(old_state, action, reward, new_state):
    """
    In DQN, we do a single-step gradient update instead of a table update.
    """
    # 1) Predict current Q-values from old_state (current state)
    old_state_array = to_array(old_state)
    Q_values_old = dqn_model.predict(old_state_array, verbose=0)[0]
    # 2) Predict Q-values for new_state to get max future Q (new state)
    new_state_array = to_array(new_state)
    Q_values_new = dqn_model.predict(new_state_array, verbose=0)[0]
    best_future_q = np.max(Q_values_new)
        
    # 3) Incorporate ALPHA to partially update the Q-value
    Q_values_old[action] = Q_values_old[action] + ALPHA * (reward + GAMMA * best_future_q - Q_values_old[action])
    
    # 4) Train (fit) the DQN on this single sample
    dqn_model.fit(old_state_array, np.array([Q_values_old]), verbose=0)

def get_action_from_policy(state):
    """
    Epsilon-greedy strategy using the DQN's predicted Q-values.
    """
    if random.random() < EPSILON:
        return random.choice(ACTIONS)
    else:
        state_array = to_array(state)
        Q_values = dqn_model.predict(state_array, verbose=0)[0]
        return int(np.argmax(Q_values))

def get_queue_length(detector_id):
    return traci.lanearea.getLastStepVehicleNumber(detector_id)

def get_current_phase(tls_id):
    return traci.trafficlight.getPhase(tls_id)

# -------------------------
# Step 8: Fully Online Continuous Learning Loop
# -------------------------

# Lists to record data for plotting
step_history = []
reward_history = []
queue_history = []

cumulative_reward = 0.0

print("\n=== Starting Dynamic Multi-Traffic Light DQN Learning ===")
print(f"Managing {len(tlm.traffic_lights)} traffic lights")
print(f"State size: {tlm.state_size}")

for step in range(TOTAL_STEPS):
    current_simulation_step = step
    
    state = get_state()
    
    # Store actions for each traffic light
    tls_actions = {}
    
    # Apply actions to all traffic lights and store them
    for tls_id in tlm.traffic_lights.keys():
        action = get_action_from_policy(state)
        tls_actions[tls_id] = action
        apply_action(action, tls_id)
    
    traci.simulationStep()  # Advance simulation by one step
    
    new_state = get_state()
    reward = tlm.get_reward(new_state)
    cumulative_reward += reward
    
    # FIX 1: Update Q-table for each traffic light's action separately
    for tls_id, action in tls_actions.items():
        update_Q_table(state, action, reward, new_state)
    
    # Record data every 100 steps
    if step % 100 == 0:
        updated_q_vals = dqn_model.predict(to_array(state), verbose=0)[0]
        total_queue = sum(new_state[:sum(len(tls_info['detectors']) for tls_info in tlm.traffic_lights.values())])
        print(f"Step {step}, Total Queue: {total_queue}, Reward: {reward:.2f}, Cumulative: {cumulative_reward:.2f}")
        print(f"Actions taken: {tls_actions}")
        step_history.append(step)
        reward_history.append(cumulative_reward)
        queue_history.append(total_queue)

# -------------------------
# Step 9: Close connection between SUMO and Traci
# -------------------------
traci.close()

# ~~~ Print final model summary ~~~
print("\nOnline Training completed.")
print("DQN Model Summary:")
dqn_model.summary()

# -------------------------
# Visualization of Results
# -------------------------

# Plot Cumulative Reward over Simulation Steps
plt.figure(figsize=(10, 6))
plt.plot(step_history, reward_history, marker='o', linestyle='-', label="Cumulative Reward")
plt.xlabel("Simulation Step")
plt.ylabel("Cumulative Reward")
plt.title("Dynamic Multi-TLS DQN: Cumulative Reward over Steps")
plt.legend()
plt.grid(True)
plt.show()

# Plot Total Queue Length over Simulation Steps
plt.figure(figsize=(10, 6))
plt.plot(step_history, queue_history, marker='o', linestyle='-', label="Total Queue Length")
plt.xlabel("Simulation Step")
plt.ylabel("Total Queue Length")
plt.title("Dynamic Multi-TLS DQN: Queue Length over Steps")
plt.legend()
plt.grid(True)
plt.show()

# Print final statistics
print(f"\nFinal Statistics:")
print(f"Total traffic lights managed: {len(tlm.traffic_lights)}")
print(f"Total detectors monitored: {sum(len(tls_info['detectors']) for tls_info in tlm.traffic_lights.values())}")
print(f"Final cumulative reward: {cumulative_reward:.2f}")
print(f"Average queue length: {np.mean(queue_history):.2f}")

# Print detector mapping summary
print(f"\nDetector Mapping Summary:")
for tls_id, tls_info in tlm.traffic_lights.items():
    print(f"Traffic Light {tls_id}: {len(tls_info['detectors'])} detectors")
    for detector_id in tls_info['detectors']:
        print(f"  - {detector_id}")
