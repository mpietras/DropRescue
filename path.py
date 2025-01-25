# a Python script to extract the control points from a path exported from Gimp

import sys
import xml.etree.ElementTree as ET
import re

tree = ET.parse(sys.argv[1])
doc = tree.getroot()
svg = doc[0]

path = svg.attrib['d']

# collapse all whitespace and replace with a single comma
path = re.sub(r'\s+', ',', path)
path = path.split('C,')[1]

number_array = [float(num) for num in path.split(',')]

# after the first control point they duplicate twice because of the bezier curves
# so just keep the control points
control_points = [number_array[0], number_array[1]]
stop_at = len(number_array) - 4
for i in range(2, stop_at, 6):
    control_points.append(number_array[i])
    control_points.append(number_array[i+1])
control_points.append(number_array[stop_at])
control_points.append(number_array[stop_at+1])

# this prints a flat array for x, y, x, y, ...
print(control_points)
