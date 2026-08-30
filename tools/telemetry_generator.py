#!/usr/bin/env python3
from __future__ import annotations
"""Send realistic synthetic ESP telemetry to EVA from outside the web UI.

Examples:
  IOT_INGEST_API_KEY=... python tools/telemetry_generator.py --scenario overheating
  IOT_INGEST_API_KEY=... python tools/telemetry_generator.py --vehicle EV-007 --scenario gps-loss
"""

import argparse
import json
import os
import random
import time
import urllib.error
import urllib.request
import threading
try:
    import tkinter as tk
    from tkinter import messagebox, ttk
except ImportError:  # CLI mode still works on headless Python installations.
    tk = ttk = messagebox = None


SCENARIOS = {"normal", "overheating", "low-battery", "gps-loss", "ble-loss", "tampering"}


def frame(vehicle: str, scenario: str, tick: int, state: dict) -> dict:
    state["soc"] = max(2, state["soc"] - (3 if scenario == "low-battery" else 0.15))
    state["temperature"] += (0.9 if scenario == "overheating" else (30 - state["temperature"]) * 0.05) + random.uniform(-0.3, 0.3)
    state["voltage"] += (-0.7 if scenario == "tampering" else (40 - state["voltage"]) * 0.05) + random.uniform(-0.08, 0.08)
    moving = scenario in {"tampering", "overheating"}
    gps_ok = not (scenario == "gps-loss" and tick > 1) and not (scenario == "tampering" and tick > 2)
    ble_ok = not (scenario == "ble-loss" and tick > 1) and not (scenario == "tampering" and tick > 2)
    state["lat"] += random.uniform(-0.0008, 0.0008) if gps_ok else 0
    state["lng"] += random.uniform(-0.0008, 0.0008) if gps_ok else 0
    result = {
        "vehicleCode": vehicle,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "temperature": round(state["temperature"], 2),
        "voltage": round(state["voltage"], 2),
        "soc": round(state["soc"]),
        "speed": random.randint(18, 30) if moving else random.choice([0, 15, 20]),
        "gpsAvailable": gps_ok,
        "bleAvailable": ble_ok,
        "bleReadings": [random.randint(-53, -47) for _ in range(5)] if ble_ok else [],
        "scenario": scenario.upper().replace("-", "_"),
    }
    if gps_ok:
        result["latitude"], result["longitude"] = round(state["lat"], 5), round(state["lng"], 5)
    return result


def find_env_api_key() -> str:
    key = os.getenv("IOT_INGEST_API_KEY")
    if key:
        return key.strip()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(os.getcwd(), ".env.local"),
        os.path.join(os.getcwd(), ".env"),
        os.path.join(script_dir, "..", ".env.local"),
        os.path.join(script_dir, "..", ".env"),
        os.path.join(script_dir, ".env"),
    ]
    for path in candidates:
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if line.startswith("IOT_INGEST_API_KEY="):
                            val = line.split("=", 1)[1].strip()
                            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                                val = val[1:-1]
                            if val:
                                return val
            except Exception:
                pass
    return ""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3000/api/telemetry")
    parser.add_argument("--key", default=None, help="IoT Ingest API key (defaults to IOT_INGEST_API_KEY from env or .env)")
    parser.add_argument("--vehicle", default="EV-014")
    parser.add_argument("--scenario", choices=sorted(SCENARIOS), default="normal")
    parser.add_argument("--interval", type=float, default=3.0)
    parser.add_argument("--count", type=int, default=0, help="Frames to send; 0 runs until Ctrl-C")
    args = parser.parse_args()
    key = args.key or find_env_api_key()
    if not key:
        raise SystemExit("IOT_INGEST_API_KEY is required (set it in .env or via IOT_INGEST_API_KEY env var / --key flag)")
    state = {"lat": 36.8065, "lng": 10.1815, "temperature": 30.0, "voltage": 40.0, "soc": 80.0}
    tick = 0
    try:
        while args.count == 0 or tick < args.count:
            tick += 1
            payload = json.dumps(frame(args.vehicle, args.scenario, tick, state)).encode()
            request = urllib.request.Request(args.url, data=payload, method="POST", headers={"content-type": "application/json", "x-iot-api-key": key})
            try:
                with urllib.request.urlopen(request, timeout=10) as response:
                    print(f"{tick}: {response.status} {payload.decode()}", flush=True)
            except urllib.error.HTTPError as error:
                print(f"{tick}: HTTP {error.code} — {error.read().decode(errors='replace')}", flush=True)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped.")


class GeneratorApp:
    """Small operator console suitable for a live demo."""

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("EVA Telemetry Simulator")
        self.root.geometry("720x540")
        self.stop_event = threading.Event()
        self.worker: threading.Thread | None = None
        self._build()

    def _build(self) -> None:
        root = self.root
        root.columnconfigure(1, weight=1)
        root.rowconfigure(5, weight=1)
        ttk.Label(root, text="EVA Telemetry Simulator", font=("Segoe UI", 18, "bold")).grid(row=0, column=0, columnspan=3, padx=20, pady=(18, 14), sticky="w")
        fields = [("App URL", "http://localhost:3000/api/telemetry"), ("API key", find_env_api_key()), ("Vehicle", "EV-014"), ("Interval (sec)", "3"), ("Frames (0 = continuous)", "0")]
        self.inputs: dict[str, ttk.Entry] = {}
        for row, (label, value) in enumerate(fields, 1):
            ttk.Label(root, text=label).grid(row=row, column=0, padx=(20, 10), pady=6, sticky="w")
            entry = ttk.Entry(root, show="*" if label == "API key" else "")
            entry.insert(0, value)
            entry.grid(row=row, column=1, columnspan=2, padx=(0, 20), pady=6, sticky="ew")
            self.inputs[label] = entry
        ttk.Label(root, text="Scenario").grid(row=6, column=0, padx=(20, 10), pady=6, sticky="w")
        self.scenario = ttk.Combobox(root, values=sorted(SCENARIOS), state="readonly")
        self.scenario.set("overheating")
        self.scenario.grid(row=6, column=1, padx=(0, 10), pady=6, sticky="ew")
        self.start_button = ttk.Button(root, text="▶ Start test", command=self.start)
        self.start_button.grid(row=6, column=2, padx=(0, 20), pady=6, sticky="e")
        self.stop_button = ttk.Button(root, text="■ Stop", command=self.stop, state="disabled")
        self.stop_button.grid(row=7, column=2, padx=(0, 20), pady=6, sticky="e")
        ttk.Label(root, text="Live log").grid(row=8, column=0, padx=(20, 10), pady=(12, 4), sticky="nw")
        self.log = tk.Text(root, height=12, state="disabled", wrap="word", background="#101827", foreground="#d9e7ff")
        self.log.grid(row=8, column=1, columnspan=2, padx=(0, 20), pady=(12, 20), sticky="nsew")

    def write_log(self, line: str) -> None:
        self.root.after(0, self._append_log, line)

    def _append_log(self, line: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", line + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def start(self) -> None:
        if self.worker and self.worker.is_alive():
            return
        key = self.inputs["API key"].get().strip()
        if not key:
            messagebox.showerror("Missing API key", "Enter the IOT_INGEST_API_KEY used by the EVA app.")
            return
        try:
            interval, count = float(self.inputs["Interval (sec)"].get()), int(self.inputs["Frames (0 = continuous)"].get())
            if interval <= 0 or count < 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Invalid settings", "Interval must be positive and frames must be 0 or greater.")
            return
        self.stop_event.clear()
        self.start_button.configure(state="disabled")
        self.stop_button.configure(state="normal")
        settings = (self.inputs["App URL"].get().strip(), key, self.inputs["Vehicle"].get().strip(), self.scenario.get(), interval, count)
        self.worker = threading.Thread(target=self._run, args=settings, daemon=True)
        self.worker.start()

    def _run(self, url: str, key: str, vehicle: str, scenario: str, interval: float, count: int) -> None:
        state = {"lat": 36.8065, "lng": 10.1815, "temperature": 30.0, "voltage": 40.0, "soc": 80.0}
        tick = 0
        while not self.stop_event.is_set() and (count == 0 or tick < count):
            tick += 1
            payload = json.dumps(frame(vehicle, scenario, tick, state)).encode()
            request = urllib.request.Request(url, data=payload, method="POST", headers={"content-type": "application/json", "x-iot-api-key": key})
            try:
                with urllib.request.urlopen(request, timeout=10) as response:
                    self.write_log(f"{tick}: HTTP {response.status} — {payload.decode()}")
            except (urllib.error.HTTPError, urllib.error.URLError) as error:
                detail = error.read().decode(errors="replace") if isinstance(error, urllib.error.HTTPError) else str(error)
                self.write_log(f"{tick}: ERROR — {detail}")
            self.stop_event.wait(interval)
        self.root.after(0, self._finished)

    def _finished(self) -> None:
        self.start_button.configure(state="normal")
        self.stop_button.configure(state="disabled")

    def stop(self) -> None:
        self.stop_event.set()
        self._finished()


if __name__ == "__main__":
    # With no command-line arguments, launch the operator-friendly GUI.
    if len(os.sys.argv) == 1:
        if tk is None:
            raise SystemExit("Tkinter is required for the interface; use CLI arguments on this machine.")
        app_root = tk.Tk()
        GeneratorApp(app_root)
        app_root.mainloop()
    else:
        main()
