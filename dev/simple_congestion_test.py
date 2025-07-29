#!/usr/bin/env python3
"""
Simple Congestion Test - Uses only valid edges
"""

import random

def create_simple_congestion():
    """Create simple congestion using only valid edges"""
    
    # Load edges for testing
    try:
        with open("edges.txt", "r") as f:
            edges = [line.strip() for line in f if line.strip()]
        print(f"✅ Loaded {len(edges)} valid edges")
    except FileNotFoundError:
        print("❌ edges.txt not found. Please run edgeIDExtractor.py first.")
        return
    
    # Use only the first 20 edges to ensure they're valid
    valid_edges = edges[:20]
    print(f"🎯 Using first {len(valid_edges)} edges for testing")
    
    # Vehicle types
    vehicle_types = ['personal', 'taxi', 'motorcycle']
    
    # Create simple congested trips
    trips = []
    trip_id = 0
    
    # Generate 2000 trips using only valid edges
    for i in range(2000):
        # Use only valid edges
        src, dst = random.sample(valid_edges, 2)
        
        # Random vehicle type
        vtype = random.choice(vehicle_types)
        
        # Departure time - spread across first 200 seconds
        depart_time = random.randint(0, 200)
        
        trip = {
            'id': f"simple_trip_{trip_id}",
            'from': src,
            'to': dst,
            'depart': depart_time,
            'type': vtype
        }
        
        trips.append(trip)
        trip_id += 1
        
        # Add additional vehicles for congestion (40% chance)
        if random.random() < 0.4:
            additional_depart = depart_time + random.randint(1, 2)  # Very close spacing
            additional_trip = {
                'id': f"simple_trip_{trip_id}_add",
                'from': src,
                'to': dst,
                'depart': additional_depart,
                'type': vtype
            }
            trips.append(additional_trip)
            trip_id += 1
    
    # Write to XML file
    with open("simple_congestion_trips.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<trips>\n')
        
        for trip in trips:
            f.write(f'    <trip id="{trip["id"]}" from="{trip["from"]}" to="{trip["to"]}" depart="{trip["depart"]}" type="{trip["type"]}"/>\n')
        
        f.write('</trips>\n')
    
    print(f"✅ Generated {len(trips)} simple congested trips")
    print("🚗 Using only valid edges from the network")
    print("🎯 Run: sumo-gui -c simple_congestion.sumocfg")

if __name__ == "__main__":
    create_simple_congestion() 