#!/usr/bin/env python3
"""
Separate Traffic Variations Generator for Addis Ababa
Creates separate trip files for each traffic pattern
"""

import random
import math
from datetime import datetime, timedelta

class SeparateTrafficVariations:
    def __init__(self):
        # Vehicle types with their characteristics
        self.vehicle_types = {
            'personal': {
                'name': 'Personal Vehicle',
                'capacity': 1,
                'speed_factor': 1.0,
                'probability': 0.35,
                'rush_hour_multiplier': 2.5,
                'regular_multiplier': 1.0
            },
            'taxi': {
                'name': 'Taxi',
                'capacity': 4,
                'speed_factor': 1.1,
                'probability': 0.20,
                'rush_hour_multiplier': 3.0,
                'regular_multiplier': 1.5
            },
            'minibus': {
                'name': 'Mini Bus',
                'capacity': 12,
                'speed_factor': 0.9,
                'probability': 0.15,
                'rush_hour_multiplier': 2.0,
                'regular_multiplier': 1.2
            },
            'public_bus': {
                'name': 'Public Bus',
                'capacity': 50,
                'speed_factor': 0.8,
                'probability': 0.10,
                'rush_hour_multiplier': 1.8,
                'regular_multiplier': 1.0
            },
            'motorcycle': {
                'name': 'Motorcycle',
                'capacity': 1,
                'speed_factor': 1.2,
                'probability': 0.15,
                'rush_hour_multiplier': 1.5,
                'regular_multiplier': 0.8
            },
            'train': {
                'name': 'Train',
                'capacity': 200,
                'speed_factor': 1.5,
                'probability': 0.03,
                'rush_hour_multiplier': 2.0,
                'regular_multiplier': 1.0
            },
            'truck': {
                'name': 'Truck',
                'capacity': 2,
                'speed_factor': 0.7,
                'probability': 0.02,
                'rush_hour_multiplier': 0.5,
                'regular_multiplier': 1.5
            }
        }
        
        # Traffic variations with specific time ranges
        self.traffic_variations = {
            'morning_rush': {
                'name': 'Morning Rush Hours',
                'start_hour': 7,
                'end_hour': 9,
                'duration_hours': 2,
                'intensity': 2.5,
                'description': '7:00 AM - 9:00 AM (Peak morning traffic)'
            },
            'evening_rush': {
                'name': 'Evening Rush Hours',
                'start_hour': 17,
                'end_hour': 19,
                'duration_hours': 2,
                'intensity': 2.5,
                'description': '5:00 PM - 7:00 PM (Peak evening traffic)'
            },
            'regular_traffic': {
                'name': 'Regular Traffic Flow',
                'start_hour': 10,
                'end_hour': 16,
                'duration_hours': 6,
                'intensity': 1.0,
                'description': '10:00 AM - 4:00 PM (Normal traffic conditions)'
            }
        }
        
        # Load edges from file
        self.edges = self.load_edges()
        
    def load_edges(self):
        """Load edge IDs from edges.txt file"""
        try:
            with open("edges.txt", "r") as f:
                edges = [line.strip() for line in f if line.strip()]
            print(f"✅ Loaded {len(edges)} edges from edges.txt")
            return edges
        except FileNotFoundError:
            print("❌ edges.txt not found. Please run edgeIDExtractor.py first.")
            return []
    
    def generate_vehicle_type(self, variation_name):
        """Generate vehicle type based on traffic variation"""
        variation = self.traffic_variations[variation_name]
        
        # Adjust probabilities based on traffic variation
        adjusted_probabilities = {}
        
        for vtype, config in self.vehicle_types.items():
            base_prob = config['probability']
            
            if variation_name in ['morning_rush', 'evening_rush']:
                # More public transport during rush hours
                if vtype in ['public_bus', 'minibus']:
                    adjusted_probabilities[vtype] = base_prob * 1.5
                elif vtype == 'personal':
                    adjusted_probabilities[vtype] = base_prob * 1.2
                else:
                    adjusted_probabilities[vtype] = base_prob
            else:
                # Regular hours - more personal vehicles
                if vtype == 'personal':
                    adjusted_probabilities[vtype] = base_prob * 1.3
                elif vtype in ['public_bus', 'minibus']:
                    adjusted_probabilities[vtype] = base_prob * 0.8
                else:
                    adjusted_probabilities[vtype] = base_prob
        
        # Normalize probabilities
        total_prob = sum(adjusted_probabilities.values())
        normalized_probs = {k: v/total_prob for k, v in adjusted_probabilities.items()}
        
        # Generate vehicle type based on probabilities
        rand_val = random.random()
        cumulative_prob = 0
        for vtype, prob in normalized_probs.items():
            cumulative_prob += prob
            if rand_val <= cumulative_prob:
                return vtype
        
        return 'personal'  # fallback
    
    def generate_realistic_od_pairs(self, num_trips):
        """Generate realistic origin-destination pairs"""
        pairs = []
        
        # Create some common routes (major corridors)
        major_routes = []
        if len(self.edges) >= 4:
            # Create some predefined major routes
            for _ in range(min(20, len(self.edges) // 4)):
                route_length = random.randint(3, 8)
                route_edges = random.sample(self.edges, route_length)
                major_routes.append(route_edges)
        
        for i in range(num_trips):
            # 70% chance of using major routes, 30% random
            if major_routes and random.random() < 0.7:
                route = random.choice(major_routes)
                src = route[0]
                dst = route[-1]
            else:
                # Random O-D pair
                src, dst = random.sample(self.edges, 2)
            
            if src != dst:
                pairs.append((src, dst))
        
        return pairs
    
    def generate_variation_trips(self, variation_name, trips_per_hour=2000):
        """Generate trips for a specific traffic variation"""
        if not self.edges:
            print("❌ No edges available. Cannot generate trips.")
            return None
        
        variation = self.traffic_variations[variation_name]
        duration_hours = variation['duration_hours']
        intensity = variation['intensity']
        
        # Calculate total trips for this variation
        total_trips = int(trips_per_hour * duration_hours * intensity)
        
        print(f"🚗 Generating {total_trips} trips for {variation['name']}")
        print(f"⏰ Time: {variation['description']}")
        print(f"📊 Intensity: {intensity}x normal traffic")
        
        trips = []
        trip_id = 0
        
        # Generate trips for each hour in the variation
        for hour_offset in range(duration_hours):
            current_hour = variation['start_hour'] + hour_offset
            
            # Calculate trips for this hour
            trips_this_hour = int(trips_per_hour * intensity)
            
            # Generate O-D pairs for this hour
            od_pairs = self.generate_realistic_od_pairs(trips_this_hour)
            
            for src, dst in od_pairs:
                # Generate vehicle type for this trip
                vehicle_type = self.generate_vehicle_type(variation_name)
                vehicle_config = self.vehicle_types[vehicle_type]
                
                # Generate departure time within this hour (in seconds)
                depart_time = (current_hour * 3600) + random.randint(0, 3599)
                
                # Create trip entry
                trip = {
                    'id': f"trip_{variation_name}_{vehicle_type}_{trip_id}",
                    'from': src,
                    'to': dst,
                    'depart': depart_time,
                    'type': vehicle_type,
                    'vehicle_class': vehicle_config['name']
                }
                
                trips.append(trip)
                trip_id += 1
        
        return trips
    
    def write_trips_to_xml(self, trips, variation_name):
        """Write trips to XML file for specific variation"""
        filename = f"trips_{variation_name}.xml"
        
        with open(filename, "w") as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            f.write('<trips>\n')
            
            for trip in trips:
                f.write(f'    <trip id="{trip["id"]}" from="{trip["from"]}" to="{trip["to"]}" depart="{trip["depart"]}" type="{trip["type"]}"/>\n')
            
            f.write('</trips>\n')
        
        print(f"✅ Generated {len(trips)} trips in {filename}")
        return filename
    
    def create_variation_config(self, variation_name, trips_filename):
        """Create SUMO configuration file for specific variation"""
        variation = self.traffic_variations[variation_name]
        config_filename = f"config_{variation_name}.sumocfg"
        
        # Calculate simulation duration in seconds
        duration_seconds = variation['duration_hours'] * 3600
        
        with open(config_filename, "w") as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            f.write('<configuration>\n')
            f.write('    <input>\n')
            f.write('        <net-file value="/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml"/>\n')
            f.write(f'        <route-files value="{trips_filename}"/>\n')
            f.write('        <additional-files value="vehicle_types.xml"/>\n')
            f.write('    </input>\n')
            f.write('    <time>\n')
            f.write('        <begin value="0"/>\n')
            f.write(f'        <end value="{duration_seconds}"/>\n')
            f.write('        <step-length value="1.0"/>\n')
            f.write('    </time>\n')
            f.write('    <processing>\n')
            f.write('        <threads value="4"/>\n')
            f.write('        <collision.action value="warn"/>\n')
            f.write('        <time-to-teleport value="300"/>\n')
            f.write('        <max-depart-delay value="900"/>\n')
            f.write('    </processing>\n')
            f.write('    <report>\n')
            f.write('        <verbose value="true"/>\n')
            f.write('        <no-step-log value="true"/>\n')
            f.write('    </report>\n')
            f.write('    <gui_only>\n')
            f.write('        <start value="0"/>\n')
            f.write('        <delay value="50"/>\n')
            f.write('    </gui_only>\n')
            f.write('    <random_number>\n')
            f.write('        <seed value="42"/>\n')
            f.write('    </random_number>\n')
            f.write('    <output>\n')
            f.write(f'        <summary value="summary_{variation_name}.xml"/>\n')
            f.write(f'        <tripinfo value="tripinfo_{variation_name}.xml"/>\n')
            f.write(f'        <fcd-output value="fcd_{variation_name}.xml"/>\n')
            f.write('    </output>\n')
            f.write('</configuration>\n')
        
        print(f"✅ Created configuration file: {config_filename}")
        return config_filename
    
    def generate_statistics(self, trips, variation_name):
        """Generate statistics for a specific variation"""
        print(f"\n📊 Statistics for {self.traffic_variations[variation_name]['name']}:")
        print("=" * 60)
        
        # Vehicle type statistics
        vehicle_counts = {}
        for trip in trips:
            vtype = trip['type']
            vehicle_counts[vtype] = vehicle_counts.get(vtype, 0) + 1
        
        print("Vehicle Type Distribution:")
        for vtype, count in sorted(vehicle_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(trips)) * 100
            print(f"  {self.vehicle_types[vtype]['name']}: {count} trips ({percentage:.1f}%)")
        
        print(f"\nTotal trips generated: {len(trips)}")
        print(f"Duration: {self.traffic_variations[variation_name]['duration_hours']} hours")
        print(f"Intensity: {self.traffic_variations[variation_name]['intensity']}x normal traffic")
        print("=" * 60)
    
    def generate_all_variations(self):
        """Generate separate trip files for all traffic variations"""
        print("🚀 Generating Separate Traffic Variations for Addis Ababa")
        print("=" * 70)
        
        if not self.edges:
            print("❌ Cannot generate trips without edges. Please run edgeIDExtractor.py first.")
            return
        
        generated_files = {}
        
        for variation_name in self.traffic_variations.keys():
            print(f"\n Processing {self.traffic_variations[variation_name]['name']}...")
            
            # Generate trips for this variation
            trips = self.generate_variation_trips(variation_name)
            
            if trips:
                # Write trips to XML file
                trips_filename = self.write_trips_to_xml(trips, variation_name)
                
                # Create configuration file
                config_filename = self.create_variation_config(variation_name, trips_filename)
                
                # Generate statistics
                self.generate_statistics(trips, variation_name)
                
                generated_files[variation_name] = {
                    'trips_file': trips_filename,
                    'config_file': config_filename,
                    'trip_count': len(trips)
                }
        
        # Generate summary
        self.generate_summary_report(generated_files)
        
        return generated_files
    
    def generate_summary_report(self, generated_files):
        """Generate a summary report of all variations"""
        print("\n📋 SUMMARY REPORT")
        print("=" * 50)
        print("Generated files for each traffic variation:")
        
        for variation_name, files in generated_files.items():
            variation = self.traffic_variations[variation_name]
            print(f"\n {variation['name']}:")
            print(f"    Trips file: {files['trips_file']}")
            print(f"   ⚙️  Config file: {files['config_file']}")
            print(f"   🚗 Total trips: {files['trip_count']}")
            print(f"   ⏰ Duration: {variation['duration_hours']} hours")
            print(f"   📊 Intensity: {variation['intensity']}x")
        
        print(f"\n🎉 All traffic variations generated successfully!")
        print("\n📝 How to run each variation:")
        print("   sumo-gui -c config_morning_rush.sumocfg")
        print("   sumo-gui -c config_evening_rush.sumocfg")
        print("   sumo-gui -c config_regular_traffic.sumocfg")

def main():
    """Main function to run the separate traffic variations generator"""
    print("🚀 Separate Traffic Variations Generator for Addis Ababa")
    print("=" * 60)
    
    generator = SeparateTrafficVariations()
    
    # Generate all variations
    generated_files = generator.generate_all_variations()
    
    if generated_files:
        print("\n🎉 Separate traffic variations generation completed successfully!")
        print("📁 Files created:")
        for variation_name, files in generated_files.items():
            print(f"  - {files['trips_file']}")
            print(f"  - {files['config_file']}")
        print("\n🖥️  You can now run each variation separately in SUMO-GUI!")
    else:
        print("\n❌ Generation failed. Please check the error messages above.")

if __name__ == "__main__":
    main()
    