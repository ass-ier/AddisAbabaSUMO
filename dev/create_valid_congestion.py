#!/usr/bin/env python3
"""
Valid Congestion Generator - Uses only connected edges that allow departures
"""

import random
import xml.etree.ElementTree as ET

def create_valid_congestion():
    """Create congestion using only connected edges that allow departures"""
    
    print("🔍 Loading network to find connected edges...")
    
    # Parse the network file to find connected edges
    try:
        tree = ET.parse('/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml')
        root = tree.getroot()
        
        # Find all edges and their connections
        edges = {}
        connections = {}
        departure_allowed_edges = set()
        
        # Extract edge information and check if departures are allowed
        for edge in root.findall('.//edge'):
            edge_id = edge.get('id')
            edge_function = edge.get('function', '')
            
            # Skip internal edges (starting with ":") and other non-drivable edges
            if edge_id.startswith(':') or edge_function in ['internal', 'crossing', 'walkingarea']:
                continue
                
            # Check if this edge has lanes that allow departures
            has_departure_lanes = False
            for lane in edge.findall('.//lane'):
                allow = lane.get('allow', '')
                disallow = lane.get('disallow', '')
                
                # If lane allows passenger vehicles and doesn't disallow them
                if ('passenger' in allow or allow == '' or allow == 'all') and 'passenger' not in disallow:
                    has_departure_lanes = True
                    break
            
            if has_departure_lanes:
                edges[edge_id] = edge
                departure_allowed_edges.add(edge_id)
        
        # Extract connection information (only for departure-allowed edges)
        for connection in root.findall('.//connection'):
            from_edge = connection.get('from')
            to_edge = connection.get('to')
            
            # Only consider connections from edges that allow departures
            if from_edge in departure_allowed_edges:
                if from_edge not in connections:
                    connections[from_edge] = []
                connections[from_edge].append(to_edge)
        
        print(f"✅ Found {len(edges)} edges and {len(connections)} connections")
        print(f"🎯 Found {len(departure_allowed_edges)} edges that allow departures")
        
    except Exception as e:
        print(f"❌ Error parsing network: {e}")
        return
    
    # Find edges that have outgoing connections and allow departures
    valid_start_edges = [edge_id for edge_id in connections.keys() 
                        if connections[edge_id] and edge_id in departure_allowed_edges]
    print(f"🎯 Found {len(valid_start_edges)} valid departure edges with connections")
    
    if len(valid_start_edges) < 10:
        print("❌ Not enough valid departure edges found")
        return
    
    # Vehicle types
    vehicle_types = ['personal', 'taxi', 'motorcycle']
    
    # Create valid congested trips
    trips = []
    trip_id = 0
    
    # Generate 3000 trips using only valid departure edges
    for i in range(3000):
        # Select a random starting edge that has connections and allows departures
        start_edge = random.choice(valid_start_edges)
        
        # Find a valid destination edge (connected to start edge)
        possible_destinations = connections[start_edge]
        if possible_destinations:
            # Take a random destination, or follow a short route
            if random.random() < 0.7:  # 70% direct connection
                end_edge = random.choice(possible_destinations)
            else:  # 30% multi-hop route
                # Try to find a 2-hop route
                end_edge = start_edge
                for hop in range(2):
                    if end_edge in connections and connections[end_edge]:
                        end_edge = random.choice(connections[end_edge])
                    else:
                        break
            
            # Only create trip if start and end are different and both allow departures
            if start_edge != end_edge and start_edge in departure_allowed_edges:
                # Random vehicle type
                vtype = random.choice(vehicle_types)
                
                # Departure time - spread across first 200 seconds
                depart_time = random.randint(0, 200)
                
                trip = {
                    'id': f"valid_trip_{trip_id}",
                    'from': start_edge,
                    'to': end_edge,
                    'depart': depart_time,
                    'type': vtype
                }
                
                trips.append(trip)
                trip_id += 1
                
                # Add additional vehicles for congestion (30% chance)
                if random.random() < 0.3:
                    additional_depart = depart_time + random.randint(1, 3)
                    additional_trip = {
                        'id': f"valid_trip_{trip_id}_add",
                        'from': start_edge,
                        'to': end_edge,
                        'depart': additional_depart,
                        'type': vtype
                    }
                    trips.append(additional_trip)
                    trip_id += 1
    
    # Sort trips by departure time
    trips.sort(key=lambda x: x['depart'])
    
    # Write to XML file as routes (not trips) to avoid the warning
    with open("valid_congestion_routes.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<routes>\n')
        
        for trip in trips:
            f.write(f'    <trip id="{trip["id"]}" from="{trip["from"]}" to="{trip["to"]}" depart="{trip["depart"]}" type="{trip["type"]}"/>\n')
        
        f.write('</routes>\n')
    
    print(f"✅ Generated {len(trips)} valid congested trips")
    print("🚗 All trips use departure-allowed edges only")
    print("🎯 Run: sumo-gui -c valid_congestion_routes.sumocfg")

if __name__ == "__main__":
    create_valid_congestion()