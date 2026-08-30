#!/usr/bin/env python3
"""
Synthetic telemetry generator for E-Move Guardian model training.

Pure standard library — runs with `python3 ml/generate_synthetic.py`.
Produces labelled CSVs of battery + movement sequences. This is SYNTHETIC
TRAINING DATA, deliberately kept separate from real production telemetry.
"""
import argparse
import csv
import math
import os
import random

BATTERY_CLASSES = [
    "healthy", "aging", "overheating", "voltage_instability", "rapid_discharge",
]
MOVEMENT_CLASSES = ["normal", "suspicious", "gps_ble_loss", "tampering"]

SEQ_LEN = 40


def battery_sequence(cls, rng):
    temp, volt, soc = 30 + rng.uniform(-2, 3), 40 + rng.uniform(-0.5, 0.5), rng.uniform(60, 95)
    rows = []
    for t in range(SEQ_LEN):
        if cls == "healthy":
            temp += (30 - temp) * 0.1 + rng.uniform(-0.3, 0.3)
            volt += (40 - volt) * 0.1 + rng.uniform(-0.05, 0.05)
            soc -= rng.uniform(0.1, 0.4)
        elif cls == "aging":
            temp += 0.15 + rng.uniform(-0.3, 0.4)
            volt -= 0.03
            soc -= rng.uniform(0.3, 0.7)
        elif cls == "overheating":
            temp += max(0, (60 - temp) * 0.2) + 0.6
            volt -= 0.15
            soc -= rng.uniform(0.4, 0.8)
        elif cls == "voltage_instability":
            temp += rng.uniform(-0.3, 0.5)
            volt += math.sin(t) * 0.6 + rng.uniform(-0.4, 0.4) - 0.05
            soc -= rng.uniform(0.2, 0.6)
        elif cls == "rapid_discharge":
            temp += 0.2
            volt -= 0.1
            soc -= rng.uniform(1.5, 3.0)
        temp = max(18, min(90, temp))
        volt = max(28, min(46, volt))
        soc = max(0, min(100, soc))
        rows.append((t, round(temp, 2), round(volt, 2), round(soc, 1), cls))
    return rows


def movement_sequence(cls, rng):
    lat, lng = 36.8065 + rng.uniform(-0.02, 0.02), 10.1815 + rng.uniform(-0.02, 0.02)
    gps = ble = 1
    rows = []
    for t in range(SEQ_LEN):
        speed = 15 + rng.uniform(-5, 8)
        if cls == "normal":
            lat += rng.uniform(-0.0008, 0.0008)
            lng += rng.uniform(-0.0008, 0.0008)
        elif cls == "suspicious":
            lat += 0.004 * (t / SEQ_LEN) + rng.uniform(-0.001, 0.001)
            lng += 0.0035 * (t / SEQ_LEN) + rng.uniform(-0.001, 0.001)
            speed = 28 + rng.uniform(-4, 8)
        elif cls == "gps_ble_loss":
            if t > SEQ_LEN * 0.6:
                gps = 0
        elif cls == "tampering":
            lat += 0.002
            lng += 0.0015
            speed = 22 + rng.uniform(-3, 5)
            if t > SEQ_LEN * 0.5:
                gps = ble = 0
        rows.append((t, round(lat, 5), round(lng, 5), round(speed, 1), gps, ble, cls))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="ml/data")
    ap.add_argument("--n", type=int, default=400, help="sequences per class")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    os.makedirs(args.out, exist_ok=True)

    bpath = os.path.join(args.out, "battery.csv")
    with open(bpath, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["seq_id", "step", "temperature", "voltage", "soc", "label"])
        sid = 0
        for cls in BATTERY_CLASSES:
            for _ in range(args.n):
                for row in battery_sequence(cls, rng):
                    w.writerow([sid, *row])
                sid += 1

    mpath = os.path.join(args.out, "movement.csv")
    with open(mpath, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["seq_id", "step", "lat", "lng", "speed", "gps", "ble", "label"])
        sid = 0
        for cls in MOVEMENT_CLASSES:
            for _ in range(args.n):
                for row in movement_sequence(cls, rng):
                    w.writerow([sid, *row])
                sid += 1

    total = args.n * (len(BATTERY_CLASSES) + len(MOVEMENT_CLASSES))
    print(f"Wrote {bpath} and {mpath} ({total} sequences, seq_len={SEQ_LEN}).")


if __name__ == "__main__":
    main()
