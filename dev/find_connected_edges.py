#!/usr/bin/env python3
"""
Find connected edges in the SUMO network for valid route generation.
"""

import xml.etree.ElementTree as ET
import random

def find_connected_edges():
    """Find edges that are connected to each other for valid routes."""
    
    print("🔍 Finding connected edges in the network...")
    
    # Parse the network file
    tree = ET.parse('/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml')
    root = tree.getroot()
    
    # Build a graph of connected edges
    connections = {}
    valid_edges = set()
    
    # Find all edges
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
            valid_edges.add(edge_id)
            connections[edge_id] = []
    
    print(f"✅ Found {len(valid_edges)} valid edges")
    
    # Find connections between edges
    for connection in root.findall('.//connection'):
        from_edge = connection.get('from')
        to_edge = connection.get('to')
        
        if from_edge in valid_edges and to_edge in valid_edges:
            if from_edge not in connections:
                connections[from_edge] = []
            connections[from_edge].append(to_edge)
    
    # Find edges with good connectivity
    well_connected_edges = []
    for edge_id, connected_to in connections.items():
        if len(connected_to) >= 2:  # At least 2 outgoing connections
            well_connected_edges.append(edge_id)
    
    print(f"✅ Found {len(well_connected_edges)} well-connected edges")
    
    # Select a subset for testing
    test_edges = random.sample(well_connected_edges, min(20, len(well_connected_edges)))
    
    print(f"🎯 Selected {len(test_edges)} test edges:")
    for edge in test_edges:
        print(f"   {edge} -> {len(connections[edge])} connections")
    
    return test_edges, connections

def create_connected_test_trips(edges, connections):
    """Create trips using only connected edges."""
    
    print("🚗 Creating connected test trips...")
    
    trips = []
    trip_id = 0
    
    # Generate trips between connected edges
    for _ in range(500):  # 500 trips
        # Pick a random starting edge
        from_edge = random.choice(edges)
        
        # Pick a destination from its connections
        if connections[from_edge]:
            to_edge = random.choice(connections[from_edge])
            
            # Create trip
            trip = {
                'id': f'connected_trip_{trip_id}',
                'from': from_edge,
                'to': to_edge,
                'depart': random.uniform(0, 100),  # Depart within first 100 seconds
                'type': random.choice(['personal', 'taxi', 'motorcycle'])
            }
            
            trips.append(trip)
            trip_id += 1
    
    # Sort by departure time
    trips.sort(key=lambda x: x['depart'])
    
    # Write to XML
    with open('connected_test_routes.xml', 'w') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<routes>\n')
        
        for trip in trips:
            f.write(f'    <trip id="{trip["id"]}" from="{trip["from"]}" to="{trip["to"]}" depart="{trip["depart"]:.1f}" type="{trip["type"]}"/>\n')
        
        f.write('</routes>\n')
    
    print(f"✅ Generated {len(trips)} connected test trips")
    print("📁 Saved to: connected_test_routes.xml")
    
    return len(trips)

if __name__ == "__main__":
    # Find connected edges
    edges, connections = find_connected_edges()
    
    # Create test trips
    trip_count = create_connected_test_trips(edges, connections)
    
    print(f"\n🎯 Run the test with:")
    print("sumo-gui -c connected_test.sumocfg") 