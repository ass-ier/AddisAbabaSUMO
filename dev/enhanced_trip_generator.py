import random
import math
from datetime import datetime, timedelta

class EnhancedTripGenerator:
    def __init__(self):
        # Vehicle types with their characteristics
        self.vehicle_types = {
            'personal': {
                'name': 'Personal Vehicle',
                'capacity': 1,
                'speed_factor': 1.0,
                'probability': 0.35,  # 35% of total traffic
                'rush_hour_multiplier': 2.5,
                'regular_multiplier': 1.0
            },
            'taxi': {
                'name': 'Taxi',
                'capacity': 4,
                'speed_factor': 1.1,
                'probability': 0.20,  # 20% of total traffic
                'rush_hour_multiplier': 3.0,
                'regular_multiplier': 1.5
            },
            'minibus': {
                'name': 'Mini Bus',
                'capacity': 12,
                'speed_factor': 0.9,
                'probability': 0.15,  # 15% of total traffic
                'rush_hour_multiplier': 2.0,
                'regular_multiplier': 1.2
            },
            'public_bus': {
                'name': 'Public Bus',
                'capacity': 50,
                'speed_factor': 0.8,
                'probability': 0.10,  # 10% of total traffic
                'rush_hour_multiplier': 1.8,
                'regular_multiplier': 1.0
            },
            'motorcycle': {
                'name': 'Motorcycle',
                'capacity': 1,
                'speed_factor': 1.2,
                'probability': 0.15,  # 15% of total traffic
                'rush_hour_multiplier': 1.5,
                'regular_multiplier': 0.8
            },
            'train': {
                'name': 'Train',
                'capacity': 200,
                'speed_factor': 1.5,
                'probability': 0.03,  # 3% of total traffic
                'rush_hour_multiplier': 2.0,
                'regular_multiplier': 1.0
            },
            'truck': {
                'name': 'Truck',
                'capacity': 2,
                'speed_factor': 0.7,
                'probability': 0.02,  # 2% of total traffic
                'rush_hour_multiplier': 0.5,
                'regular_multiplier': 1.5
            }
        }
        
        # Traffic time patterns (24-hour format)
        self.traffic_patterns = {
            'morning_rush': {
                'start_hour': 7,
                'end_hour': 9,
                'peak_hour': 8,
                'intensity': 2.5
            },
            'evening_rush': {
                'start_hour': 17,
                'end_hour': 19,
                'peak_hour': 18,
                'intensity': 2.5
            },
            'regular_traffic': {
                'start_hour': 10,
                'end_hour': 16,
                'intensity': 1.0
            },
            'night_traffic': {
                'start_hour': 22,
                'end_hour': 6,
                'intensity': 0.3
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
    
    def get_traffic_intensity(self, hour):
        """Get traffic intensity multiplier for a given hour"""
        if self.traffic_patterns['morning_rush']['start_hour'] <= hour <= self.traffic_patterns['morning_rush']['end_hour']:
            # Morning rush hour with peak at 8 AM
            peak_hour = self.traffic_patterns['morning_rush']['peak_hour']
            distance_from_peak = abs(hour - peak_hour)
            return self.traffic_patterns['morning_rush']['intensity'] * math.exp(-distance_from_peak * 0.5)
        
        elif self.traffic_patterns['evening_rush']['start_hour'] <= hour <= self.traffic_patterns['evening_rush']['end_hour']:
            # Evening rush hour with peak at 6 PM
            peak_hour = self.traffic_patterns['evening_rush']['peak_hour']
            distance_from_peak = abs(hour - peak_hour)
            return self.traffic_patterns['evening_rush']['intensity'] * math.exp(-distance_from_peak * 0.5)
        
        elif self.traffic_patterns['regular_traffic']['start_hour'] <= hour <= self.traffic_patterns['regular_traffic']['end_hour']:
            return self.traffic_patterns['regular_traffic']['intensity']
        
        else:
            # Night traffic (10 PM - 6 AM)
            return self.traffic_patterns['night_traffic']['intensity']
    
    def generate_vehicle_type(self, hour):
        """Generate vehicle type based on time and probabilities"""
        # Adjust probabilities based on time
        adjusted_probabilities = {}
        
        for vtype, config in self.vehicle_types.items():
            base_prob = config['probability']
            
            # Adjust based on time of day
            if self.traffic_patterns['morning_rush']['start_hour'] <= hour <= self.traffic_patterns['morning_rush']['end_hour']:
                # More public transport during rush hours
                if vtype in ['public_bus', 'minibus']:
                    adjusted_probabilities[vtype] = base_prob * 1.5
                elif vtype == 'personal':
                    adjusted_probabilities[vtype] = base_prob * 1.2
                else:
                    adjusted_probabilities[vtype] = base_prob
            elif self.traffic_patterns['evening_rush']['start_hour'] <= hour <= self.traffic_patterns['evening_rush']['end_hour']:
                # Similar pattern for evening rush
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
    
    def generate_trip_departure_time(self, hour):
        """Generate departure time within the specified hour"""
        # Add some randomness within the hour (in seconds)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        return hour * 3600 + minute * 60 + second
    
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
    
    def generate_enhanced_trips(self, total_trips=50000):
        """Generate enhanced trips with multiple vehicle types and traffic patterns"""
        if not self.edges:
            print("❌ No edges available. Cannot generate trips.")
            return
        
        print(f"🚗 Generating {total_trips} enhanced trips...")
        
        trips = []
        trip_id = 0
        
        # Generate trips for each hour of the day
        for hour in range(24):
            # Get traffic intensity for this hour
            intensity = self.get_traffic_intensity(hour)
            
            # Calculate number of trips for this hour
            base_trips_per_hour = total_trips // 24
            trips_this_hour = int(base_trips_per_hour * intensity)
            
            # Generate O-D pairs for this hour
            od_pairs = self.generate_realistic_od_pairs(trips_this_hour)
            
            for src, dst in od_pairs:
                # Generate vehicle type for this trip
                vehicle_type = self.generate_vehicle_type(hour)
                vehicle_config = self.vehicle_types[vehicle_type]
                
                # Generate departure time within this hour
                depart_time = self.generate_trip_departure_time(hour)
                
                # Create trip entry
                trip = {
                    'id': f"trip_{vehicle_type}_{trip_id}",
                    'from': src,
                    'to': dst,
                    'depart': depart_time,
                    'type': vehicle_type,
                    'vehicle_class': vehicle_config['name']
                }
                
                trips.append(trip)
                trip_id += 1
        
        # Write trips to XML file
        self.write_trips_to_xml(trips)
        
        # Generate statistics
        self.generate_statistics(trips)
        
        return trips
    
    def write_trips_to_xml(self, trips):
        """Write trips to XML file with vehicle type information"""
        with open("enhanced_trips.xml", "w") as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            f.write('<trips>\n')
            
            for trip in trips:
                f.write(f'    <trip id="{trip["id"]}" from="{trip["from"]}" to="{trip["to"]}" depart="{trip["depart"]}" type="{trip["type"]}"/>\n')
            
            f.write('</trips>\n')
        
        print(f"✅ Generated {len(trips)} enhanced trips in enhanced_trips.xml")
    
    def generate_statistics(self, trips):
        """Generate and display trip statistics"""
        print("\n📊 Trip Generation Statistics:")
        print("=" * 50)
        
        # Vehicle type statistics
        vehicle_counts = {}
        for trip in trips:
            vtype = trip['type']
            vehicle_counts[vtype] = vehicle_counts.get(vtype, 0) + 1
        
        print("Vehicle Type Distribution:")
        for vtype, count in sorted(vehicle_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(trips)) * 100
            print(f"  {self.vehicle_types[vtype]['name']}: {count} trips ({percentage:.1f}%)")
        
        # Time distribution
        hour_counts = {}
        for trip in trips:
            hour = trip['depart'] // 3600
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
        
        print("\nTraffic Distribution by Hour:")
        for hour in range(24):
            count = hour_counts.get(hour, 0)
            intensity = self.get_traffic_intensity(hour)
            print(f"  {hour:02d}:00 - {count:4d} trips (intensity: {intensity:.2f})")
        
        print(f"\nTotal trips generated: {len(trips)}")
        print("=" * 50)

def main():
    """Main function to run the enhanced trip generator"""
    print("🚀 Enhanced Trip Generator for Addis Ababa Traffic Simulation")
    print("=" * 60)
    
    generator = EnhancedTripGenerator()
    
    # Generate enhanced trips
    trips = generator.generate_enhanced_trips(total_trips=50000)
    
    if trips:
        print("\n🎉 Enhanced trip generation completed successfully!")
        print("📁 Files created:")
        print("  - enhanced_trips.xml (main trip file)")
        print("  - Check console output for detailed statistics")
    else:
        print("\n❌ Trip generation failed. Please check the error messages above.")

if __name__ == "__main__":
    main()