#!/usr/bin/env python3
"""
Generate scenario variations for Addis Ababa SUMO setup.

It reads the base route file (flows) and produces three variants:
- offpeak: lower demand (period *= 1.5), begin shifted later (+300s)
- peak: higher demand (period *= 0.67), begin shifted earlier (-300s, floored at 0)
- jitter: same demand but with +/-10% period jitter and +/-120s begin jitter (seeded)

For each variant, a cloned .sumocfg is created from AddisAbabaSimple.sumocfg
with the <route-files> pointing to the new route file and a distinct seed.

Outputs:
- addisTrafficFullNetwork_offpeak.rou.xml
- addisTrafficFullNetwork_peak.rou.xml
- addisTrafficFullNetwork_jitter.rou.xml
- AddisAbabaSimple_offpeak.sumocfg
- AddisAbabaSimple_peak.sumocfg
- AddisAbabaSimple_jitter.sumocfg
"""

import os
import xml.etree.ElementTree as ET
import random

BASE_SUMOCFG = "AddisAbabaSimple.sumocfg"
BASE_ROUTES = "addisTrafficFullNetwork.rou.xml"

SCENARIOS = {
    "offpeak": {
        "period_mul": 1.5,
        "begin_shift": 300,
        "seed": 101,
        "jitter": False,
    },
    "peak": {
        "period_mul": 0.67,
        "begin_shift": -300,
        "seed": 202,
        "jitter": False,
    },
    "jitter": {
        "period_mul": 1.0,
        "begin_shift": 0,
        "seed": 303,
        "jitter": True,
    },
}


def read_routes(path):
    tree = ET.parse(path)
    root = tree.getroot()
    return tree, root


def write_routes(tree, path):
    tree.write(path, encoding="utf-8", xml_declaration=True)


def modify_flows(root, scenario_key, cfg):
    rng = random.Random(cfg["seed"])  # deterministic

    for flow in root.findall("flow"):
        # Adjust period (demand)
        if "period" in flow.attrib:
            try:
                period = float(flow.attrib["period"])
                period *= cfg["period_mul"]
                if cfg.get("jitter"):
                    period *= rng.uniform(0.9, 1.1)
                flow.set("period", str(max(0.1, round(period, 2))))
            except Exception:
                pass

        # Adjust begin time
        if "begin" in flow.attrib:
            try:
                begin = float(flow.attrib["begin"])
                begin += cfg["begin_shift"]
                if cfg.get("jitter"):
                    begin += rng.uniform(-120, 120)
                begin = max(0.0, round(begin, 2))
                flow.set("begin", str(begin))
            except Exception:
                pass

        # Adjust end to remain >= begin
        if "end" in flow.attrib and "begin" in flow.attrib:
            try:
                begin = float(flow.attrib["begin"])
                end = float(flow.attrib["end"])
                if end < begin + 60:  # ensure at least 1 minute window
                    end = begin + 60
                flow.set("end", str(round(end, 2)))
            except Exception:
                pass


def make_sumocfg_variant(in_sumocfg, out_sumocfg, routes_path, seed_value):
    tree = ET.parse(in_sumocfg)
    root = tree.getroot()

    # Update route-files value
    for input_tag in root.findall("input"):
        for rf in input_tag.findall("route-files"):
            rf.set("value", routes_path)

    # Update seed
    for rnd in root.findall("random_number"):
        for seed in rnd.findall("seed"):
            seed.set("value", str(seed_value))

    tree.write(out_sumocfg, encoding="utf-8", xml_declaration=True)


def main():
    if not os.path.exists(BASE_SUMOCFG):
        raise FileNotFoundError(f"Missing {BASE_SUMOCFG}")
    if not os.path.exists(BASE_ROUTES):
        raise FileNotFoundError(f"Missing {BASE_ROUTES}")

    for name, cfg in SCENARIOS.items():
        print(f"Creating scenario: {name}")
        tree, root = read_routes(BASE_ROUTES)
        modify_flows(root, name, cfg)

        routes_out = f"addisTrafficFullNetwork_{name}.rou.xml"
        write_routes(tree, routes_out)
        print(f"  Wrote routes: {routes_out}")

        sumocfg_out = f"AddisAbabaSimple_{name}.sumocfg"
        make_sumocfg_variant(BASE_SUMOCFG, sumocfg_out, routes_out, cfg["seed"])
        print(f"  Wrote sumocfg: {sumocfg_out}")

    print("\n✅ Scenarios generated: offpeak, peak, jitter")


if __name__ == "__main__":
    main()
