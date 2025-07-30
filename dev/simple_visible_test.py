#!/usr/bin/env python3
"""
Simple Visible Test - Creates obvious traffic for troubleshooting
"""

import random

def create_simple_visible_test():
    """Create simple, very visible traffic"""
    
    print("🔍 Creating simple visible test...")
    
    # Use a small set of common edge IDs that should be visible
    # These are typical road edge patterns
    test_edges = [
        "45190338#5", "45190338#6", "45190338#7",
        "35471078#1", "35471078#2", "35471078#3", 
        "42836273#0", "42836273#1", "42836273#2",
        "267940728#10", "267940728#11", "267940728#12",
        "152080724#5", "152080724#6", "152080724#7"
    ]
    
    # Vehicle types
    vehicle_types = ['personal', 'taxi', 'motorcycle']
    
    # Create very simple, visible trips
    trips = []
    trip_id = 0
    
    # Generate 500 trips that should be very visible
    for i in range(500):
        # Use only the test edges
        start_edge = random.choice(test_edges)
        end_edge = random.choice(test_edges)
        
        # Make sure start and end are different
        while end_edge == start_edge:
            end_edge = random.choice(test_edges)
        
        # Random vehicle type
        vtype = random.choice(vehicle_types)
        
        # Departure time - start immediately and spread over 100 seconds
        depart_time = random.randint(0, 100)
        
        trip = {
            'id': f"visible_trip_{trip_id}",
            'from': start_edge,
            'to': end_edge,
            'depart': depart_time,
            'type': vtype
        }
        
        trips.append(trip)
        trip_id += 1
        
        # Add additional vehicles for density (50% chance)
        if random.random() < 0.5:
            additional_depart = depart_time + random.randint(1, 2)
            additional_trip = {
                'id': f"visible_trip_{trip_id}_add",
                'from': start_edge,
                'to': end_edge,
                'depart': additional_depart,
                'type': vtype
            }
            trips.append(additional_trip)
            trip_id += 1
    
    # Sort trips by departure time
    trips.sort(key=lambda x: x['depart'])
    
    # Write to XML file
    with open("simple_visible_routes.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<routes>\n')
        
        for trip in trips:
            f.write(f'    <trip id="{trip["id"]}" from="{trip["from"]}" to="{trip["to"]}" depart="{trip["depart"]}" type="{trip["type"]}"/>\n')
        
        f.write('</routes>\n')
    
    print(f"✅ Generated {len(trips)} simple visible trips")
    print("🚗 Using common road edges that should be visible")
    print("🎯 Run: sumo-gui -c simple_visible.sumocfg")
    print("\n📋 Troubleshooting tips:")
    print("1. Check the status bar for vehicle count")
    print("2. Look for the 'Vehicles' tab in the right panel")
    print("3. Try zooming in on the network")
    print("4. Check if simulation is paused (play button)")

if __name__ == "__main__":
    create_simple_visible_test() 