import xml.etree.ElementTree as ET

# Parse the network XML file
tree = ET.parse('/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml')
root = tree.getroot()

# Extract edge IDs (ignore internal edges)
edges = [edge.attrib['id'] for edge in root.findall('edge') if not edge.attrib['id'].startswith(':')]

# Save edge IDs
with open('edges.txt', 'w') as f:
    for edge in edges:
        f.write(edge + '\n')

print(f"Extracted {len(edges)} edges to edges.txt")
