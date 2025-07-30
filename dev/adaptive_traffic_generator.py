#!/usr/bin/env python3
"""
Adaptive Traffic Signal Control Traffic Generator
Generates realistic traffic data for LOS E-F congestion scenarios.
"""

import xml.etree.ElementTree as ET
import random
import math
import json
from datetime import datetime, timedelta

class AdaptiveTrafficGenerator:
    def __init__(self, network_file):
        self.network_file = network_file
        self.intersections = {}
        self.approaches = {}
        self.vehicle_types = {
            'private_car': {'probability': 0.75, 'length': 4.5, 'max_speed': 50},
            'minibus': {'probability': 0.15, 'length': 7.0, 'max_speed': 40},
            'truck': {'probability': 0.08, 'length': 12.0, 'max_speed': 35},
            'bus': {'probability': 0.02, 'length': 12.0, 'max_speed': 35}
        }
        
        # Traffic volume specifications
        self.traffic_volumes = {
            'major_intersection': {'min': 1400, 'max': 1800},
            'secondary_intersection': {'min': 1100, 'max': 1300},
            'minor_intersection': {'min': 900, 'max': 1100}
        }
        
        # Congestion parameters (LOS E-F)
        self.congestion_params = {
            'delay_range': (300, 700),  # seconds
            'saturation_flow': 1800,    # vehicles/hour/lane
            'main_corridor_ratio': 0.60,
            'cross_street_ratio': 0.40
        }
        
        self.parse_network()
    
    def parse_network(self):
        """Parse the network file to identify intersections and approaches."""
        print("🔍 Parsing network for intersections...")
        
        tree = ET.parse(self.network_file)
        root = tree.getroot()
        
        # Find all junctions (intersections)
        for junction in root.findall('.//junction'):
            junction_id = junction.get('id')
            junction_type = junction.get('type')
            
            if junction_type in ['priority', 'traffic_light', 'right_before_left']:
                # Classify intersection type based on connections
                connections = len(junction.findall('.//connection'))
                if connections >= 8:  # 4-leg intersection
                    intersection_type = 'major_intersection'
                elif connections >= 6:  # 3-leg intersection
                    intersection_type = 'secondary_intersection'
                else:
                    intersection_type = 'minor_intersection'
                
                self.intersections[junction_id] = {
                    'type': intersection_type,
                    'junction_type': junction_type,
                    'connections': connections,
                    'approaches': []
                }
        
        # Find approaches to intersections
        for connection in root.findall('.//connection'):
            from_edge = connection.get('from')
            to_edge = connection.get('to')
            junction = connection.get('via')
            
            if junction in self.intersections:
                approach = {
                    'from_edge': from_edge,
                    'to_edge': to_edge,
                    'junction': junction,
                    'direction': self.get_direction(from_edge, to_edge)
                }
                self.intersections[junction]['approaches'].append(approach)
        
        print(f"✅ Found {len(self.intersections)} intersections")
    
    def get_direction(self, from_edge, to_edge):
        """Determine traffic direction for approach."""
        # Simplified direction detection
        directions = ['north', 'south', 'east', 'west']
        return random.choice(directions)
    
    def generate_traffic_flow(self, simulation_duration=3600):
        """Generate realistic traffic flow data."""
        print("🚗 Generating traffic flow data...")
        
        traffic_data = {
            'simulation_duration': simulation_duration,
            'intersections': {},
            'vehicle_trips': [],
            'signal_phases': {},
            'congestion_metrics': {}
        }
        
        # Generate traffic for each intersection
        for junction_id, intersection in self.intersections.items():
            intersection_data = self.generate_intersection_traffic(
                junction_id, intersection, simulation_duration
            )
            traffic_data['intersections'][junction_id] = intersection_data
        
        # Generate vehicle trips
        traffic_data['vehicle_trips'] = self.generate_vehicle_trips(traffic_data)
        
        # Generate signal phases
        traffic_data['signal_phases'] = self.generate_signal_phases(traffic_data)
        
        # Calculate congestion metrics
        traffic_data['congestion_metrics'] = self.calculate_congestion_metrics(traffic_data)
        
        return traffic_data
    
    def generate_intersection_traffic(self, junction_id, intersection, duration):
        """Generate traffic data for a specific intersection."""
        
        intersection_type = intersection['type']
        volume_range = self.traffic_volumes[intersection_type]
        
        # Generate hourly volumes for each approach
        approaches = intersection['approaches']
        approach_traffic = {}
        
        for approach in approaches:
            # Base volume for approach
            base_volume = random.randint(volume_range['min'], volume_range['max'])
            
            # Apply main corridor vs cross street distribution
            if approach['direction'] in ['east', 'west']:  # Main corridor
                volume = int(base_volume * self.congestion_params['main_corridor_ratio'])
            else:  # Cross street
                volume = int(base_volume * self.congestion_params['cross_street_ratio'])
            
            # Generate time-based variations (peak hours, etc.)
            time_variations = self.generate_time_variations(duration, volume)
            
            approach_traffic[approach['from_edge']] = {
                'volume': volume,
                'time_variations': time_variations,
                'direction': approach['direction'],
                'to_edge': approach['to_edge']
            }
        
        return {
            'type': intersection_type,
            'approaches': approach_traffic,
            'total_volume': sum(approach['volume'] for approach in approach_traffic.values())
        }
    
    def generate_time_variations(self, duration, base_volume):
        """Generate realistic time-based traffic variations."""
        
        variations = []
        hours = duration // 3600
        
        for hour in range(hours):
            # Peak hour multipliers
            if 7 <= hour <= 9:  # Morning peak
                multiplier = random.uniform(1.8, 2.2)
            elif 17 <= hour <= 19:  # Evening peak
                multiplier = random.uniform(1.6, 2.0)
            elif 12 <= hour <= 14:  # Midday
                multiplier = random.uniform(1.2, 1.4)
            else:  # Off-peak
                multiplier = random.uniform(0.6, 0.9)
            
            # Add some randomness
            multiplier *= random.uniform(0.9, 1.1)
            
            hourly_volume = int(base_volume * multiplier)
            variations.append({
                'hour': hour,
                'volume': hourly_volume,
                'multiplier': multiplier
            })
        
        return variations
    
    def generate_vehicle_trips(self, traffic_data):
        """Generate individual vehicle trips."""
        
        trips = []
        trip_id = 0
        
        for junction_id, intersection_data in traffic_data['intersections'].items():
            for from_edge, approach_data in intersection_data['approaches'].items():
                
                # Generate trips for this approach
                total_trips = sum(v['volume'] for v in approach_data['time_variations'])
                
                for _ in range(total_trips):
                    # Determine departure time
                    departure_hour = random.randint(0, len(approach_data['time_variations']) - 1)
                    departure_minute = random.randint(0, 59)
                    departure_second = random.randint(0, 59)
                    
                    departure_time = departure_hour * 3600 + departure_minute * 60 + departure_second
                    
                    # Select vehicle type
                    vehicle_type = self.select_vehicle_type()
                    
                    # Generate route (simplified - just from edge to to edge)
                    route = self.generate_route(from_edge, approach_data['to_edge'])
                    
                    trip = {
                        'id': f'trip_{trip_id}',
                        'from_edge': from_edge,
                        'to_edge': approach_data['to_edge'],
                        'departure_time': departure_time,
                        'vehicle_type': vehicle_type,
                        'route': route,
                        'intersection': junction_id,
                        'direction': approach_data['direction']
                    }
                    
                    trips.append(trip)
                    trip_id += 1
        
        # Sort by departure time
        trips.sort(key=lambda x: x['departure_time'])
        
        return trips
    
    def select_vehicle_type(self):
        """Select vehicle type based on probabilities."""
        rand = random.random()
        cumulative = 0
        
        for vtype, params in self.vehicle_types.items():
            cumulative += params['probability']
            if rand <= cumulative:
                return vtype
        
        return 'private_car'  # Default
    
    def generate_route(self, from_edge, to_edge):
        """Generate a route between two edges."""
        # Simplified route generation - in practice, this would use pathfinding
        return [from_edge, to_edge]
    
    def generate_signal_phases(self, traffic_data):
        """Generate traffic signal phases for adaptive control."""
        
        signal_phases = {}
        
        for junction_id, intersection_data in traffic_data['intersections'].items():
            if intersection_data['type'] in ['major_intersection', 'secondary_intersection']:
                
                # Generate signal phases based on traffic demand
                phases = self.generate_intersection_phases(intersection_data)
                signal_phases[junction_id] = phases
        
        return signal_phases
    
    def generate_intersection_phases(self, intersection_data):
        """Generate signal phases for a specific intersection."""
        
        approaches = intersection_data['approaches']
        
        # Determine phase structure based on intersection type
        if len(approaches) >= 8:  # 4-leg intersection
            phases = [
                {'name': 'Phase1', 'duration': 90, 'approaches': ['north', 'south']},
                {'name': 'Phase2', 'duration': 90, 'approaches': ['east', 'west']},
                {'name': 'Phase3', 'duration': 30, 'approaches': ['north', 'south']},  # Left turn
                {'name': 'Phase4', 'duration': 30, 'approaches': ['east', 'west']}   # Left turn
            ]
        else:  # 3-leg intersection
            phases = [
                {'name': 'Phase1', 'duration': 60, 'approaches': ['main']},
                {'name': 'Phase2', 'duration': 60, 'approaches': ['cross']}
            ]
        
        return phases
    
    def calculate_congestion_metrics(self, traffic_data):
        """Calculate congestion metrics for LOS E-F conditions."""
        
        metrics = {
            'average_delay': random.randint(300, 700),  # seconds
            'queue_length': random.randint(50, 150),    # vehicles
            'throughput': random.uniform(0.6, 0.8),     # vehicles per hour
            'level_of_service': random.choice(['E', 'F']),
            'spillback_probability': random.uniform(0.3, 0.7)
        }
        
        return metrics
    
    def export_sumo_routes(self, traffic_data, output_file):
        """Export traffic data as SUMO route file."""
        
        print(f"📁 Exporting SUMO routes to {output_file}...")
        
        with open(output_file, 'w') as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            f.write('<routes>\n')
            
            # Write vehicle types
            for vtype, params in self.vehicle_types.items():
                f.write(f'    <vType id="{vtype}" length="{params["length"]}" maxSpeed="{params["max_speed"]}"/>\n')
            
            # Write trips
            for trip in traffic_data['vehicle_trips']:
                f.write(f'    <trip id="{trip["id"]}" from="{trip["from_edge"]}" to="{trip["to_edge"]}" ')
                f.write(f'depart="{trip["departure_time"]}" type="{trip["vehicle_type"]}"/>\n')
            
            f.write('</routes>\n')
        
        print(f"✅ Exported {len(traffic_data['vehicle_trips'])} trips")
    
    def export_json_data(self, traffic_data, output_file):
        """Export traffic data as JSON for analysis."""
        
        print(f"📁 Exporting JSON data to {output_file}...")
        
        with open(output_file, 'w') as f:
            json.dump(traffic_data, f, indent=2)
        
        print("✅ JSON data exported")
    
    def export_csv_summary(self, traffic_data, output_file):
        """Export summary data as CSV."""
        
        print(f"📁 Exporting CSV summary to {output_file}...")
        
        with open(output_file, 'w') as f:
            f.write("Intersection,Type,Total_Volume,Approaches,Avg_Delay,LOS\n")
            
            for junction_id, intersection_data in traffic_data['intersections'].items():
                metrics = traffic_data['congestion_metrics']
                f.write(f"{junction_id},{intersection_data['type']},{intersection_data['total_volume']},")
                f.write(f"{len(intersection_data['approaches'])},{metrics['average_delay']},{metrics['level_of_service']}\n")
        
        print("✅ CSV summary exported")

def main():
    """Main function to generate adaptive traffic data."""
    
    network_file = '/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml'
    
    print("🚦 Adaptive Traffic Signal Control Traffic Generator")
    print("=" * 60)
    
    # Initialize generator
    generator = AdaptiveTrafficGenerator(network_file)
    
    # Generate traffic data
    traffic_data = generator.generate_traffic_flow(simulation_duration=3600)
    
    # Export data in multiple formats
    generator.export_sumo_routes(traffic_data, 'adaptive_traffic_routes.xml')
    generator.export_json_data(traffic_data, 'adaptive_traffic_data.json')
    generator.export_csv_summary(traffic_data, 'adaptive_traffic_summary.csv')
    
    # Print summary
    print("\n📊 Traffic Generation Summary:")
    print(f"   Total Intersections: {len(traffic_data['intersections'])}")
    print(f"   Total Vehicle Trips: {len(traffic_data['vehicle_trips'])}")
    print(f"   Signalized Intersections: {len(traffic_data['signal_phases'])}")
    print(f"   Average Delay: {traffic_data['congestion_metrics']['average_delay']} seconds")
    print(f"   Level of Service: {traffic_data['congestion_metrics']['level_of_service']}")
    
    print(f"\n🎯 Run simulation with:")
    print("sumo-gui -c adaptive_traffic.sumocfg")

if __name__ == "__main__":
    main() 