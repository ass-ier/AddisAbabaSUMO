#!/usr/bin/env python3
"""
Heavy Congestion Test Generator
Creates dense traffic that will cause visible congestion
"""

import random

def create_congested_test():
    """Create heavily congested traffic for testing"""
    
    # Load edges for testing
    try:
        with open("edges.txt", "r") as f:
            edges = [line.strip() for line in f if line.strip()]
        print(f"✅ Loaded {len(edges)} edges")
    except FileNotFoundError:
        print("❌ edges.txt not found. Please run edgeIDExtractor.py first.")
        return
    
    # Select a few major routes to create congestion
    if len(edges) >= 10:
        # Create 5 major routes for heavy traffic using valid edges
        major_routes = []
        for i in range(5):
            route_length = random.randint(3, 8)
            # Use only valid edges from the loaded list
            route_edges = random.sample(edges, route_length)
            major_routes.append(route_edges)
        
        print(f"🎯 Created {len(major_routes)} major routes for congestion")
        print(f"📊 Using {len(edges)} valid edges from network")
    else:
        print("❌ Not enough edges for route creation")
        return
    
    # Vehicle types (focus on personal vehicles and taxis for congestion)
    vehicle_types = ['personal', 'taxi', 'personal', 'taxi', 'motorcycle']  # More personal vehicles
    
    # Create heavily congested trips
    trips = []
    trip_id = 0
    
    # Generate 5000 trips for heavy congestion
    for i in range(5000):
        # 80% chance to use major routes (creates congestion)
        if random.random() < 0.8 and major_routes:
            route = random.choice(major_routes)
            src = route[0]
            dst = route[-1]
        else:
            # 20% random trips
            src, dst = random.sample(edges, 2)
        
        # Random vehicle type
        vtype = random.choice(vehicle_types)
        
        # Departure time - spread across first 300 seconds for continuous congestion
        depart_time = random.randint(0, 300)
        
        trip = {
            'id': f"congested_trip_{trip_id}",
            'from': src,
            'to': dst,
            'depart': depart_time,
            'type': vtype
        }
        
        trips.append(trip)
        trip_id += 1
        
        # Add additional vehicles for extra congestion (50% chance)
        if random.random() < 0.5:
            additional_depart = depart_time + random.randint(1, 3)  # Very close spacing
            additional_trip = {
                'id': f"congested_trip_{trip_id}_add",
                'from': src,
                'to': dst,
                'depart': additional_depart,
                'type': vtype
            }
            trips.append(additional_trip)
            trip_id += 1
    
    # Sort trips by departure time before writing
    trips.sort(key=lambda x: x['depart'])
    
    # Write to XML file
    with open("congested_test_trips.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<trips>\n')
        
        for trip in trips:
            f.write(f'    <trip id="{trip["id"]}" from="{trip["from"]}" to="{trip["to"]}" depart="{trip["depart"]}" type="{trip["type"]}"/>\n')
        
        f.write('</trips>\n')
    
    print(f"✅ Generated {len(trips)} heavily congested trips")
    print("🚗 Traffic focused on major routes for visible congestion")
    print("🎯 Run: sumo-gui -c congested_test.sumocfg")

if __name__ == "__main__":
    create_congested_test() 