#!/usr/bin/env python3
"""
Create longer routes with multiple edges to keep vehicles visible longer.
"""

import xml.etree.ElementTree as ET
import random
import networkx as nx

def build_network_graph():
    """Build a graph of the network for finding longer routes."""
    
    print("🔍 Building network graph...")
    
    # Parse the network file
    tree = ET.parse('/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml')
    root = tree.getroot()
    
    # Build graph
    G = nx.DiGraph()
    valid_edges = set()
    
    # Find all valid edges
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
            G.add_node(edge_id)
    
    print(f"✅ Found {len(valid_edges)} valid edges")
    
    # Add connections as edges
    for connection in root.findall('.//connection'):
        from_edge = connection.get('from')
        to_edge = connection.get('to')
        
        if from_edge in valid_edges and to_edge in valid_edges:
            G.add_edge(from_edge, to_edge)
    
    print(f"✅ Added {G.number_of_edges()} connections")
    
    return G

def find_longer_routes(G, num_routes=200, min_length=5, max_length=15):
    """Find longer routes with multiple edges."""
    
    print(f"🎯 Finding {num_routes} longer routes...")
    
    routes = []
    nodes = list(G.nodes())
    
    for i in range(num_routes):
        attempts = 0
        while attempts < 50:  # Try up to 50 times per route
            # Pick random start and end
            start = random.choice(nodes)
            end = random.choice(nodes)
            
            if start != end:
                try:
                    # Find shortest path
                    path = nx.shortest_path(G, start, end)
                    
                    # Check if path is long enough
                    if min_length <= len(path) <= max_length:
                        routes.append(path)
                        break
                        
                except nx.NetworkXNoPath:
                    pass
                    
            attempts += 1
    
    print(f"✅ Found {len(routes)} valid longer routes")
    return routes

def create_longer_trips(routes):
    """Create trips using longer routes."""
    
    print("🚗 Creating longer route trips...")
    
    trips = []
    trip_id = 0
    
    # Create trips with longer routes
    for route in routes:
        # Create multiple trips on this route
        for _ in range(3):  # 3 trips per route
            trip = {
                'id': f'long_trip_{trip_id}',
                'route': route,
                'depart': random.uniform(0, 300),  # Depart within first 5 minutes
                'type': random.choice(['personal', 'taxi', 'motorcycle'])
            }
            
            trips.append(trip)
            trip_id += 1
    
    # Sort by departure time
    trips.sort(key=lambda x: x['depart'])
    
    # Write to XML
    with open('longer_routes.xml', 'w') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<routes>\n')
        
        # Write vehicle types first
        f.write('    <!-- Vehicle types are defined in vehicle_types.xml -->\n')
        
        # Write routes
        for trip in trips:
            route_edges = ' '.join(trip['route'])
            f.write(f'    <trip id="{trip["id"]}" depart="{trip["depart"]:.1f}" type="{trip["type"]}" from="{trip["route"][0]}" to="{trip["route"][-1]}"/>\n')
        
        f.write('</routes>\n')
    
    print(f"✅ Generated {len(trips)} longer route trips")
    print("📁 Saved to: longer_routes.xml")
    
    return len(trips)

if __name__ == "__main__":
    try:
        # Build network graph
        G = build_network_graph()
        
        # Find longer routes
        routes = find_longer_routes(G, num_routes=200, min_length=5, max_length=15)
        
        # Create trips
        trip_count = create_longer_trips(routes)
        
        print(f"\n🎯 Run the test with:")
        print("sumo-gui -c longer_routes.sumocfg")
        
    except ImportError:
        print("❌ NetworkX not installed. Installing...")
        import subprocess
        subprocess.run(['pip3', 'install', 'networkx'])
        print("✅ NetworkX installed. Please run this script again.") 