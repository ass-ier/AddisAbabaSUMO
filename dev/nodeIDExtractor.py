import xml.etree.ElementTree as ET

# Load the SUMO network file
tree = ET.parse('/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml')  # Make sure the file path is correct
root = tree.getroot()

# Define junction types to exclude (internal nodes and others not useful for routing)
excluded_types = {'internal', 'dead_end', 'unregulated', 'walkingarea', 'rail_signal'}

# Extract junction IDs that are not excluded types
valid_nodes = [
    junction.attrib['id']
    for junction in root.findall('junction')
    if junction.attrib.get('type') not in excluded_types
]

# Save the result to a text file
with open('nodes.txt', 'w') as f:
    for node_id in valid_nodes:
        f.write(node_id + '\n')

print(f"Extracted {len(valid_nodes)} valid junction IDs to nodes.txt")
