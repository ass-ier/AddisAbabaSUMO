#!/usr/bin/env python3
import sys
import math
import xml.etree.ElementTree as ET

STEPS = [2,3,4,5,6,7,8,9,10]

def parse_float(x, default=None):
    try:
        return float(x)
    except Exception:
        return default

def retime(in_path: str, out_path: str) -> None:
    tree = ET.parse(in_path)
    root = tree.getroot()
    if not root.tag.endswith('routes'):
        raise RuntimeError(f"Top element is not <routes> in {in_path}")

    t = 0.0
    step_idx = 0
    for e in list(root):
        if e.tag not in ('vehicle', 'flow'):
            continue
        step = STEPS[step_idx]
        step_idx = (step_idx + 1) % len(STEPS)

        # Assign new start
        if e.tag == 'vehicle':
            e.set('depart', f"{t:.2f}")
        else:  # flow
            old_begin = parse_float(e.attrib.get('begin'), 0.0)
            old_end = parse_float(e.attrib.get('end'), None)
            duration = None if old_end is None else max(0.0, old_end - (old_begin or 0.0))
            e.set('begin', f"{t:.2f}")
            if duration is not None:
                e.set('end', f"{t + duration:.2f}")

        t += step

    tree.write(out_path, encoding='utf-8', xml_declaration=True)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python retime_routes.py <in.rou.xml> <out.rou.xml>')
        sys.exit(2)
    retime(sys.argv[1], sys.argv[2])
