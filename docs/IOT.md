# IoT & RF architecture

## Conceptual hardware node (ESP32)

Each moped carries an ESP32 that collects and transmits vehicle identity, BLE identity,
GPS location, battery temperature, battery voltage, SOC, speed, and connectivity status.

```
Battery ── temperature sensor ─┐
Battery ── voltage sense circuit ─┤
GPS module ───────────────────────┼──► ESP32 ──► (MQTT / Internet) ──► Backend
BLE ──────────────────────────────┘
```

The battery is **not** digitally connected to the ESP32; a temperature sensor is placed on/
near the pack and a safe voltage-measurement circuit sits across the terminals. BLE
provides **identity/proximity only** — GPS provides location. The system never claims BLE
gives GPS-grade positioning.

## Telemetry contract (`EspTelemetry`)

A **stable schema** — the simulator and a real ESP32 post exactly the same shape, so
hardware can replace the simulator with **no backend change**:

```json
{
  "vehicleCode": "EV-014",
  "batteryCode": "BAT-038",
  "timestamp": "2026-08-30T18:03:12Z",
  "latitude": 36.8065, "longitude": 10.1815,
  "temperature": 42.5, "voltage": 39.2, "soc": 48, "speed": 28,
  "bleReadings": [-48, -50, -49, -85, -51],
  "gpsAvailable": true, "bleAvailable": true,
  "scenario": "NORMAL"
}
```

Multiple raw `bleReadings` are sent so the server can apply robust filtering (see
[`AI.md`](AI.md#robust-ble--rf-mitigation)); the server stores a single robust estimate
plus a confidence band.

## Simulator scenarios

`NORMAL, LOW_BATTERY, OVERHEATING, VOLTAGE_ANOMALY, BATTERY_DEGRADATION, GPS_LOSS,
BLE_LOSS, TAMPERING, SUSPICIOUS_MOVEMENT, THEFT_RISK` — each drives the per-vehicle
physical state. Controllable from the owner **Demo Control** panel or `POST /api/sim`.

## RF interference mitigation

- Repeated BLE advertisements → multiple readings per frame.
- Outlier removal (modified z-score / MAD) + median/robust estimate.
- RSSI **stability** → HIGH/MEDIUM/LOW **confidence** shown in the UI.
- Gateway redundancy modelled at important hubs (`Hub.gateways`), not everywhere.
- Timestamped telemetry + **offline store-and-forward**: when a vehicle is "offline" the
  simulator buffers frames and flushes them on reconnect (`drainBuffer`).

## Connectivity / failure handling

The platform degrades gracefully: missing GPS/BLE, missing sensors, invalid, duplicate, or
delayed telemetry are tolerated; if the AI is unavailable a safe fallback rules path keeps
the dashboard usable.

## Going real

1. Run an MQTT broker (e.g. Mosquitto); set `MQTT_URL`.
2. Add a thin bridge that subscribes to the device topic and calls `ingestTelemetry()`.
3. Flash ESP32s to publish the `EspTelemetry` JSON. Nothing else changes.
