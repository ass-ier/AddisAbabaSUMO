#!/usr/bin/env python3
"""
Working Adaptive Traffic Generator - Guaranteed to generate trips
Implements research specifications with reliable trip generation.
"""

import xml.etree.ElementTree as ET
import random
import json

def generate_working_adaptive_traffic():
    """Generate working adaptive traffic data that matches research specs."""
    
    print("🚦 Working Adaptive Traffic Generator")
    print("=" * 50)
    print("📋 Research Specifications:")
    print("   • Major intersections: 1,400-1,800 vehicles/hour per approach")
    print("   • Secondary intersections: 1,100-1,300 vehicles/hour per approach")
    print("   • Minor intersections: 900-1,100 vehicles/hour per approach")
    print("   • LOS E-F congestion: 300-700 seconds delay per vehicle")
    print("   • Vehicle mix: 75% cars, 15% minibuses, 8% trucks, 2% buses")
    print("=" * 50)
    
    # Parse network to get valid edges
    print("🔍 Getting valid edges from network...")
    tree = ET.parse('/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml')
    root = tree.getroot()
    
    valid_edges = []
    
    # Get valid edges (simplified approach)
    for edge in root.findall('.//edge'):
        edge_id = edge.get('id')
        
        # Skip internal edges
        if edge_id.startswith(':'):
            continue
            
        # Skip non-drivable edges
        edge_function = edge.get('function')
        if edge_function in ['internal', 'crossing', 'walkingarea']:
            continue
            
        # Check if edge allows passenger vehicles
        allows_passenger = False
        for lane in edge.findall('lane'):
            allow = lane.get('allow', '')
            disallow = lane.get('disallow', '')
            
            if 'passenger' in allow or ('passenger' not in disallow and disallow != 'all'):
                allows_passenger = True
                break
                
        if allows_passenger:
            valid_edges.append(edge_id)
    
    print(f"✅ Found {len(valid_edges)} valid edges")
    
    # Select edges for different intersection types
    major_edges = random.sample(valid_edges, min(50, len(valid_edges)//3))
    secondary_edges = random.sample([e for e in valid_edges if e not in major_edges], min(100, len(valid_edges)//3))
    minor_edges = random.sample([e for e in valid_edges if e not in major_edges and e not in secondary_edges], min(200, len(valid_edges)//3))
    
    print(f"🎯 Selected edges:")
    print(f"   Major intersections: {len(major_edges)} edges")
    print(f"   Secondary intersections: {len(secondary_edges)} edges")
    print(f"   Minor intersections: {len(minor_edges)} edges")
    
    # Vehicle types and probabilities (research specifications)
    vehicle_types = {
        'private_car': 0.75,
        'minibus': 0.15,
        'truck': 0.08,
        'bus': 0.02
    }
    
    # Generate trips with research-compliant volumes
    trips = []
    trip_id = 0
    
    # Major intersections: 1,400-1,800 vehicles/hour per approach
    for edge in major_edges:
        volume = random.randint(1400, 1800)
        trips.extend(generate_trips_for_edge(edge, volume, vehicle_types, trip_id, "major"))
        trip_id += volume
    
    # Secondary intersections: 1,100-1,300 vehicles/hour per approach
    for edge in secondary_edges:
        volume = random.randint(1100, 1300)
        trips.extend(generate_trips_for_edge(edge, volume, vehicle_types, trip_id, "secondary"))
        trip_id += volume
    
    # Minor intersections: 900-1,100 vehicles/hour per approach
    for edge in minor_edges:
        volume = random.randint(900, 1100)
        trips.extend(generate_trips_for_edge(edge, volume, vehicle_types, trip_id, "minor"))
        trip_id += volume
    
    # Sort by departure time
    trips.sort(key=lambda x: x['depart'])
    
    print(f"✅ Generated {len(trips)} trips total")
    
    # Write routes file
    print("📁 Writing routes file...")
    with open('working_adaptive_routes.xml', 'w') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<routes>\n')
        
        for trip in trips:
            f.write(f'    <trip id="{trip["id"]}" from="{trip["from"]}" to="{trip["to"]}" ')
            f.write(f'depart="{trip["depart"]:.1f}" type="{trip["type"]}"/>\n')
        
        f.write('</routes>\n')
    
    print("✅ Routes file written: working_adaptive_routes.xml")
    
    # Create research summary
    summary = {
        'total_trips': len(trips),
        'major_intersections': len(major_edges),
        'secondary_intersections': len(secondary_edges),
        'minor_intersections': len(minor_edges),
        'vehicle_distribution': vehicle_types,
        'traffic_volumes': {
            'major': '1,400-1,800 vehicles/hour per approach',
            'secondary': '1,100-1,300 vehicles/hour per approach',
            'minor': '900-1,100 vehicles/hour per approach'
        },
        'congestion_level': 'LOS E-F',
        'delay_range': '300-700 seconds per vehicle',
        'saturation_flow': '1,800 vehicles/hour/lane',
        'adaptive_control_ready': True
    }
    
    # Write JSON summary
    with open('working_adaptive_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    print("✅ Summary written: working_adaptive_summary.json")
    
    # Print summary
    print(f"\n📊 Research-Compliant Traffic Summary:")
    print(f"   Total Trips: {len(trips)}")
    print(f"   Major Intersections: {len(major_edges)}")
    print(f"   Secondary Intersections: {len(secondary_edges)}")
    print(f"   Minor Intersections: {len(minor_edges)}")
    print(f"   Vehicle Mix: {vehicle_types}")
    print(f"   Congestion Level: LOS E-F")
    print(f"   Delay Range: 300-700 seconds per vehicle")
    
    print(f"\n🎯 Run simulation with:")
    print("sumo-gui -c working_adaptive.sumocfg")

def generate_trips_for_edge(edge, volume, vehicle_types, start_id, intersection_type):
    """Generate trips for a specific edge with research-compliant volumes."""
    
    trips = []
    
    # Generate trips over 1 hour (3600 seconds)
    for i in range(volume):
        # Random departure time within the hour
        depart_time = random.uniform(0, 3600)
        
        # Random destination (different from origin)
        all_edges = get_all_valid_edges()
        to_edge = random.choice(all_edges)
        while to_edge == edge:
            to_edge = random.choice(all_edges)
        
        # Select vehicle type based on research probabilities
        rand = random.random()
        cumulative = 0
        selected_type = 'private_car'  # default
        
        for vtype, prob in vehicle_types.items():
            cumulative += prob
            if rand <= cumulative:
                selected_type = vtype
                break
        
        trip = {
            'id': f'{intersection_type}_trip_{start_id + i}',
            'from': edge,
            'to': to_edge,
            'depart': depart_time,
            'type': selected_type
        }
        
        trips.append(trip)
    
    return trips

def get_all_valid_edges():
    """Get all valid edges for destination selection."""
    tree = ET.parse('/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml')
    root = tree.getroot()
    
    valid_edges = []
    
    for edge in root.findall('.//edge'):
        edge_id = edge.get('id')
        
        if edge_id.startswith(':'):
            continue
            
        edge_function = edge.get('function')
        if edge_function in ['internal', 'crossing', 'walkingarea']:
            continue
            
        allows_passenger = False
        for lane in edge.findall('lane'):
            allow = lane.get('allow', '')
            disallow = lane.get('disallow', '')
            
            if 'passenger' in allow or ('passenger' not in disallow and disallow != 'all'):
                allows_passenger = True
                break
                
        if allows_passenger:
            valid_edges.append(edge_id)
    
    return valid_edges

if __name__ == "__main__":
    generate_working_adaptive_traffic() 