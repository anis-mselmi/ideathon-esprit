# Architecture

## Overview

EVA is a **modular monolith** (Next.js) with a clearly separated AI layer and
IoT simulator, so it can later split into services without rewriting business logic.

```
CLIENT / OWNER (browser, PWA)
        │  HTTPS
        ▼
┌───────────────────────────────────────────┐
│ Next.js App                               │
│  • React UI (Tailwind, i18n/RTL)          │
│  • REST API /api/*  (RBAC-guarded)        │
│  • SSE /api/stream  (realtime push)       │
│                                           │
│  lib/                                     │
│   auth · booking · engine · telemetry     │
│   simulator · sim-manager · rental-monitor│
│   events (pub/sub) · ai/*                 │
└───────┬───────────────┬───────────────────┘
        │               │
        ▼               ▼
   Prisma / SQLite   AI service layer  ◄──── ESP32 simulator (telemetry contract)
   (normalized DB)   (detection + fuzzy)      GPS · BLE · temp · voltage
        ▲               │
        └── Risk / Decision engine ── incidents · notifications · risk scores
```

## Data flow (telemetry → action)

1. **Simulator** (or a real ESP32) produces a telemetry frame in the `EspTelemetry`
   contract and posts it (`ingestTelemetry`).
2. **Ingestion** robust-filters BLE readings (median + MAD outlier removal → confidence
   band), persists `Telemetry`, `VehicleLocation`, `BatteryReading`, and emits a live
   `telemetry` event.
3. **Engine** (`evaluateVehicle`) pulls the recent window, builds rental context, runs
   the **AI detectors** and the **fuzzy decision layer**, and writes a `RiskScore`.
4. If the decision warrants it, the engine creates/refreshes an **Incident** (deduped),
   flags the vehicle `AT_RISK`, and generates owner **Notifications**.
5. **SSE** pushes `incident` / `risk` / `notification` events; the dashboards update with
   no refresh.
6. The **rental monitor** independently advances rental lifecycle and notifies the client
   (ending-soon → expired → overdue) and the owner (return required).

## Database model (Prisma)

Core entities: `User` (role, sensitive identity), `Vehicle`, `Battery`, `Hub`,
`Telemetry`, `BatteryReading`, `VehicleLocation`, `Reservation`, `Rental`, `Incident`,
`RiskScore`, `AiPrediction`, `BatteryAssignment`, `MaintenanceRecord`, `Notification`,
`Payment`, `AuditLog`.

Key relationships:

- `User 1─* Reservation`, `User 1─* Rental`, `User 1─* Notification`
- `Vehicle *─1 Battery` (current), `Vehicle 1─* Telemetry / VehicleLocation / Rental /
  Incident / RiskScore`
- `Battery 1─* BatteryReading / BatteryAssignment / AiPrediction`; `Hub 1─* Battery`
- `Reservation 1─1 Rental` (a reservation converts to a rental)

Indexes are declared on hot paths (`Telemetry[vehicleId,timestamp]`,
`Incident[status,severity]`, `Notification[userId,read]`, …). Telemetry is separated from
aggregated battery readings so raw data can be retained short-term and rolled up
long-term.

State consistency is enforced in code: a battery cannot be both `ASSIGNED` and available;
a vehicle cannot be `AVAILABLE` with an active rental; reservations check availability
(no overlapping reservation or rental) before confirmation.

## User roles

- **OWNER** — full fleet/battery/rental/incident/tracking/insights access + hub + demo.
- **CLIENT** — browse, book, modify/cancel own reservations, own rentals + notifications,
  profile. **Never** sees telemetry, AI internals, other clients, or fleet analytics.
- **ADMIN/TECHNICIAN** — reserved for the future (role field exists).

Authorization is enforced by `requireUser(role)` on every endpoint and by the SSE stream
(clients receive only their own notification events).

## Realtime

An in-process `EventEmitter` (`lib/events.ts`) is the pub/sub bus; `/api/stream` is an
SSE endpoint that filters events by role. In a multi-instance deployment this bus becomes
Redis pub/sub or a broker — the emit/subscribe interface stays the same.

## Scaling path

10 → 10,000+ vehicles: keep the boundaries (ingestion, AI inference, business logic, DB,
realtime) and introduce a queue in front of ingestion + inference, Postgres with
partitioned telemetry, Redis-backed SSE, and a dedicated Python AI service. No business
logic rewrite is required.
