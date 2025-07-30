#!/usr/bin/env python3
"""
Valid Congestion Generator - Uses only connected edges
"""

import random
import xml.etree.ElementTree as ET

def create_valid_congestion():
    """Create congestion using only connected edges"""
    
    print("🔍 Loading network to find connected edges...")
    
    # Parse the network file to find connected edges
    try:
        tree = ET.parse('/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml')
        root = tree.getroot()
        
        # Find all edges and their connections
        edges = {}
        connections = {}
        
        # Extract edge information
        for edge in root.findall('.//edge'):
            edge_id = edge.get('id')
            edges[edge_id] = edge
        
        # Extract connection information
        for connection in root.findall('.//connection'):
            from_edge = connection.get('from')
            to_edge = connection.get('to')
            
            if from_edge not in connections:
                connections[from_edge] = []
            connections[from_edge].append(to_edge)
        
        print(f"✅ Found {len(edges)} edges and {len(connections)} connections")
        
    except Exception as e:
        print(f"❌ Error parsing network: {e}")
        return
    
    # Find edges that have outgoing connections
    valid_start_edges = [edge_id for edge_id in connections.keys() if connections[edge_id]]
    print(f"🎯 Found {len(valid_start_edges)} edges with valid connections")
    
    if len(valid_start_edges) < 10:
        print("❌ Not enough connected edges found")
        return
    
    # Vehicle types
    vehicle_types = ['personal', 'taxi', 'motorcycle']
    
    # Create valid congested trips
    trips = []
    trip_id = 0
    
    # Generate 3000 trips using only connected edges
    for i in range(3000):
        # Select a random starting edge that has connections
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
            
            # Only create trip if start and end are different
            if start_edge != end_edge:
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
    
    # Write to XML file
    with open("valid_congestion_trips.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<trips>\n')
        
        for trip in trips:
            f.write(f'    <trip id="{trip["id"]}" from="{trip["from"]}" to="{trip["to"]}" depart="{trip["depart"]}" type="{trip["type"]}"/>\n')
        
        f.write('</trips>\n')
    
    print(f"✅ Generated {len(trips)} valid congested trips")
    print("🚗 All trips use connected edges only")
    print("🎯 Run: sumo-gui -c valid_congestion.sumocfg")

if __name__ == "__main__":
    create_valid_congestion() 