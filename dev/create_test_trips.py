#!/usr/bin/env python3
"""
Simple Test Trip Generator
Creates immediate traffic for testing visibility
"""

import random

def create_test_trips():
    """Create test trips that start immediately"""
    
    # Load some edges for testing
    try:
        with open("edges.txt", "r") as f:
            edges = [line.strip() for line in f if line.strip()]
        print(f"✅ Loaded {len(edges)} edges")
    except FileNotFoundError:
        print("❌ edges.txt not found. Please run edgeIDExtractor.py first.")
        return
    
    # Vehicle types
    vehicle_types = ['personal', 'taxi', 'minibus', 'public_bus', 'motorcycle']
    
    # Create trips that start immediately
    trips = []
    trip_id = 0
    
    # Generate 1000 trips that start within the first 100 seconds
    for i in range(1000):
        # Random edge pair
        src, dst = random.sample(edges, 2)
        
        # Random vehicle type
        vtype = random.choice(vehicle_types)
        
        # Departure time within first 100 seconds
        depart_time = random.randint(0, 100)
        
        trip = {
            'id': f"test_trip_{trip_id}",
            'from': src,
            'to': dst,
            'depart': depart_time,
            'type': vtype
        }
        
        trips.append(trip)
        trip_id += 1
    
    # Write to XML file
    with open("test_trips.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<trips>\n')
        
        for trip in trips:
            f.write(f'    <trip id="{trip["id"]}" from="{trip["from"]}" to="{trip["to"]}" depart="{trip["depart"]}" type="{trip["type"]}"/>\n')
        
        f.write('</trips>\n')
    
    print(f"✅ Generated {len(trips)} test trips in test_trips.xml")
    print("🚗 All trips start within the first 100 seconds")
    print("🎯 Run: sumo-gui -c test_congestion.sumocfg")

if __name__ == "__main__":
    create_test_trips() 