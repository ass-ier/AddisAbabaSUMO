# Addis Ababa Traffic Simulation System

A comprehensive traffic simulation system for Addis Ababa, Ethiopia, supporting multiple vehicle types with realistic traffic patterns.

## 🚗 Features

### Vehicle Types Supported
- **Personal Vehicles** (35% of traffic) - Regular cars and private vehicles
- **Taxis** (20% of traffic) - Taxi services with higher speed factors
- **Mini Buses** (15% of traffic) - Local minibus transportation
- **Public Buses** (10% of traffic) - Large public transportation buses
- **Motorcycles** (15% of traffic) - Two-wheeled vehicles
- **Trains** (3% of traffic) - Rail transportation
- **Trucks** (2% of traffic) - Commercial freight vehicles

### Traffic Patterns
- **Morning Rush Hours** (7-9 AM) - Peak traffic with 2.5x intensity
- **Evening Rush Hours** (5-7 PM) - Peak traffic with 2.5x intensity  
- **Regular Traffic** (10 AM-4 PM) - Normal traffic flow
- **Night Traffic** (10 PM-6 AM) - Low traffic with 0.3x intensity

## 📁 File Structure

```
dev/
├── AddisAbaba.net.xml              # SUMO network file
├── enhanced_trip_generator.py      # Enhanced trip generation with multiple vehicle types
├── vehicle_types.xml               # Vehicle type definitions for SUMO
├── addis_ababa_simulation.sumocfg  # SUMO configuration file
├── comprehensive_traffic_simulator.py # Main simulation engine
├── run_simulation.py               # Workflow runner script
├── edgeIDExtractor.py              # Extract road edges from network
├── nodeIDExtractor.py              # Extract junctions from network
└── README.md                       # This file
```

## 🚀 Quick Start

### Prerequisites
1. **SUMO Installation**: Install SUMO (Simulation of Urban MObility)
   - Download from: https://sumo.dlr.de/docs/Downloads.php
   - Add SUMO to your system PATH

2. **Python Dependencies**:
   ```bash
   pip install matplotlib pandas
   ```

### Running the Simulation

#### Option 1: Complete Workflow (Recommended)
```bash
python3 run_simulation.py
```

This will:
1. Extract network data (edges and nodes)
2. Generate enhanced trips with multiple vehicle types
3. Run the comprehensive simulation
4. Generate analysis and visualizations

#### Option 2: Individual Components

1. **Extract Network Data**:
   ```bash
   python3 edgeIDExtractor.py
   python3 nodeIDExtractor.py
   ```

2. **Generate Enhanced Trips**:
   ```bash
   python3 enhanced_trip_generator.py
   ```

3. **Run Simulation**:
   ```bash
   python3 comprehensive_traffic_simulator.py
   ```

#### Option 3: GUI Mode
```bash
python3 run_simulation.py --gui
# or
python3 comprehensive_traffic_simulator.py --gui
```

## 📊 Output Files

### Generated Files
- `enhanced_trips.xml` - Trip definitions with vehicle types
- `summary.xml` - Simulation summary statistics
- `tripinfo.xml` - Detailed trip information
- `vehroute.xml` - Vehicle route data
- `fcd.xml` - Floating car data (positions and speeds)
- `simulation_report.txt` - Comprehensive analysis report

### Visualizations (in `plots/` directory)
- `vehicle_distribution.png` - Distribution of vehicle types
- `traffic_flow.png` - Traffic flow over time
- `speed_analysis.png` - Average speeds by vehicle type

## ⚙️ Configuration

### Vehicle Type Parameters
Each vehicle type has configurable parameters in `vehicle_types.xml`:
- **accel/decel**: Acceleration and deceleration rates
- **maxSpeed**: Maximum speed
- **length**: Vehicle length
- **capacity**: Passenger capacity
- **speedFactor**: Speed multiplier

### Traffic Patterns
Traffic intensity varies throughout the day:
- **Morning Rush**: 7-9 AM (2.5x intensity)
- **Evening Rush**: 5-7 PM (2.5x intensity)
- **Regular Hours**: 10 AM-4 PM (1.0x intensity)
- **Night Hours**: 10 PM-6 AM (0.3x intensity)

### Simulation Parameters
- **Duration**: 24 hours (86,400 seconds)
- **Time Step**: 1 second
- **Total Trips**: 50,000 (configurable)

## 🔧 Customization

### Adding New Vehicle Types
1. Add vehicle type definition to `vehicle_types.xml`
2. Update vehicle type configuration in `enhanced_trip_generator.py`
3. Adjust probabilities and traffic patterns as needed

### Modifying Traffic Patterns
Edit the `traffic_patterns` dictionary in `enhanced_trip_generator.py`:
```python
self.traffic_patterns = {
    'morning_rush': {
        'start_hour': 7,
        'end_hour': 9,
        'peak_hour': 8,
        'intensity': 2.5
    },
    # ... other patterns
}
```

### Adjusting Vehicle Type Distribution
Modify the `probability` values in the `vehicle_types` dictionary:
```python
'personal': {
    'probability': 0.35,  # 35% of total traffic
    # ... other parameters
}
```

## 📈 Analysis Features

### Performance Metrics
- **Trip Duration**: Average travel time by vehicle type
- **Waiting Time**: Time spent waiting at intersections
- **Distance Traveled**: Route length statistics
- **Speed Analysis**: Average speeds by vehicle type

### Traffic Flow Analysis
- **Real-time Traffic**: Number of vehicles on the network
- **Congestion Detection**: Waiting vehicles and delays
- **Peak Hour Analysis**: Traffic patterns during rush hours

### Visualization
- **Bar Charts**: Vehicle type distribution
- **Time Series**: Traffic flow over 24 hours
- **Speed Comparisons**: Performance by vehicle type

## 🐛 Troubleshooting

### Common Issues

1. **SUMO not found**:
   - Ensure SUMO is installed and in PATH
   - Try running `sumo --version` in terminal

2. **Missing network file**:
   - Ensure `AddisAbaba.net.xml` is in the current directory
   - Check file permissions

3. **Python dependencies missing**:
   ```bash
   pip install matplotlib pandas
   ```

4. **Memory issues with large simulations**:
   - Reduce total number of trips in `enhanced_trip_generator.py`
   - Increase time step in `addis_ababa_simulation.sumocfg`

### Performance Tips
- Use command-line mode for faster execution
- Reduce simulation duration for testing
- Adjust time step for balance between accuracy and speed

## 📝 License

This project is part of a senior project for Addis Ababa traffic simulation.

## 🤝 Contributing

For questions or improvements, please contact the development team.

---

**Note**: This system is designed specifically for Addis Ababa's road network and traffic patterns. Adjust parameters for other cities accordingly.