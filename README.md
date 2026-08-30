# ⚡ E-Move Guardian

**Smart electric mobility management for safer micro-leasing.**

An intelligent electric-mobility operating platform for small e-mobility businesses
(especially women micro-entrepreneurs) managing electric mopeds and battery-swapping
operations. It connects **vehicle → battery → IoT sensors → GPS → BLE → backend → AI →
risk scoring → recommended actions → owner command center**, with a separate, simple
booking experience for renters.

> **Sense → Understand → Act.** The owner never has to read raw telemetry — the
> platform turns data into interpretation into a recommended action.

---

## Table of contents

1. [What's implemented](#whats-implemented)
2. [Tech stack & why](#tech-stack--why)
3. [Honest simplifications](#honest-simplifications)
4. [Quick start](#quick-start)
5. [Demo scenario](#demo-scenario)
6. [Architecture](#architecture)
7. [The AI layer](#the-ai-layer)
8. [Project structure](#project-structure)
9. [API reference](#api-reference)
10. [Environment variables](#environment-variables)
11. [Testing](#testing)
12. [Security & privacy](#security--privacy)
13. [Production considerations](#production-considerations)

---

## What's implemented

**Owner portal** — Command Center (prioritized incidents + fleet overview), Fleet
management + vehicle detail with live telemetry charts, Battery list + full **Battery
Passport** (SOH/RUL/history), **Battery Hub** with compatibility-checked swaps, **Live
Tracking** map (Leaflet/OSM), Rentals with owner-only identity, Alerts/incident triage
with "Why?" explanations, business **Insights** dashboard, and a **Demo Control Panel**.

**Client portal** — Browse available vehicles, 4-step **Booking** (date/time/duration →
identity → payment → confirm) with dynamic pricing, **My Rentals** with **modify** and
**cancel**, notification center, profile.

**Intelligence** — battery anomaly detection, battery fault diagnosis, battery State of
Health + Remaining Useful Life, theft/unauthorized-movement detection, tampering
detection, a **fuzzy decision engine**, risk fusion, and automatic incident + notification
generation.

**Platform** — JWT cookie auth + RBAC, real-time updates via SSE, an in-process **ESP32
fleet simulator** (BLE noise, RF outliers, GPS/BLE loss, offline buffering), rental
lifecycle monitor (ending-soon → expired → overdue), English/French/**Arabic + RTL**,
responsive design + PWA, audit logging, seed data, and a test suite.

---

## Tech stack & why

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 15 (App Router) + TypeScript** | One runnable process for frontend **and** REST API; future-native-compatible. |
| UI | **Tailwind CSS** | Cohesive design system, easy RTL. |
| DB | **SQLite + Prisma** | Zero-config local dev. Change one line to move to Postgres. |
| Auth | **JWT (httpOnly cookie) + bcrypt** (`jose`) | Secure, dependency-light. |
| Realtime | **Server-Sent Events** | Robust one-way push; simpler than Socket.IO on Next. |
| AI | **TypeScript service layer** | Runs in-process; stable JSON contract lets a Python service drop in. |
| IoT | **In-process ESP32 simulator** | Same telemetry contract as real hardware. |
| Maps | **Leaflet + OpenStreetMap** | Open, no API key. |
| Charts | **Recharts** | Clean, responsive. |
| i18n | Custom dictionary (en/fr/ar) + RTL | No hardcoded visible strings. |
| Tests | **Vitest** | Fast unit tests for the AI + booking logic. |

---

## Honest simplifications

Per the spec's instruction to clearly flag what is simplified and why:

1. **AI models are implemented as interpretable TypeScript algorithms, not trained
   PyTorch networks.** The spec calls for GRU/LSTM autoencoders, temporal transformers,
   and XGBoost. Here, each detector implements the *same contract and role* using robust
   statistics (reconstruction-error-style deviation, EWMA trends, robust BLE median/MAD,
   trajectory deviation, weighted-feature SOH). **Why:** it runs on any laptop with no
   Python/GPU, and the JSON contract + `AI_SERVICE_URL` hook mean a real Python/FastAPI
   service can replace it without touching the backend. The intended neural architecture
   is documented in [`docs/AI.md`](docs/AI.md) and the `ml/` pipeline sketch.
2. **IoT transport is in-process, not MQTT/Mosquitto.** The simulator calls the same
   `ingestTelemetry()` an MQTT bridge would. Set `MQTT_URL` and add a thin bridge to go
   real. The telemetry **schema is stable** (see `EspTelemetry`).
3. **Database is SQLite, not Postgres.** The Prisma schema is Postgres-ready; switch the
   `provider` and `DATABASE_URL`.
4. **Payments are mocked** — no card data is ever collected or stored.
5. **Push notifications** are in-app + SSE. Web Push/FCM wiring is documented but not
   enabled by default.

Nothing here is a disconnected mock: every feature talks to the real backend, database,
AI layer, or simulator.

---

## Quick start

**Prerequisites:** Node.js 20+ (tested on 24), npm.

```bash
# 1. Install
npm install

# 2. Configure env (defaults are fine for local dev)
cp .env.example .env

# 3. Create the database schema and seed demo data
npm run db:reset        # = db push + seed (20 vehicles, 30 batteries, 5 hubs, clients…)

# 4. Run
npm run dev
```

Open **http://localhost:3000**.

**Demo accounts**
- Owner: `owner@emove.tn` / `owner123`
- Client: `client@emove.tn` / `client123`

---

## Demo scenario

1. Sign in as the **owner**.
2. Go to **Demo Control** (`/owner/demo`) → click **🎬 Run full demo scenario**.
3. This starts the simulator and:
   - triggers **battery overheating** on `EV-014`,
   - forces an **expired rental** on `EV-007` that then **moves suspiciously and loses
     GPS/BLE** (theft + tampering).
4. Open the **Command Center** — within seconds you'll see prioritized incidents:
   - 🔴 `EV-014` **Battery stress detected** (HIGH) with an interpretation + action,
   - 🔴 `EV-007` **Return required** (rental overdue),
   - 🔴 `EV-007` **Possible device tampering**.
5. Click **Why?** on any incident to reveal the underlying AI scores.
6. Fix it: open **Battery Hub**, pick `EV-014`, accept the recommended healthy battery,
   **Assign** → vehicle returns to READY. Resolve the incident to clear the AT_RISK flag.

You can also trigger individual scenarios per vehicle from the same panel.

---

## Architecture

```
 CLIENT (browser / PWA)                     OWNER (browser / PWA)
        │                                          │
        └──────────────► Next.js App ◄─────────────┘
                          ├─ React UI (i18n/RTL, Tailwind)
                          ├─ REST API (/api/*)  ── RBAC guard
                          ├─ SSE stream (/api/stream)
                          │
        ┌─────────────────┼────────────────────────────┐
        ▼                 ▼                              ▼
   Prisma / SQLite    AI service layer            ESP32 simulator
   (vehicles,         (battery, theft,            (telemetry in the
    batteries,         tampering, SOH,             real ESP32 contract:
    telemetry,         fuzzy fusion)               GPS, BLE, temp, voltage)
    rentals,               │                              │
    incidents…)            ▼                              │
        ▲            Risk / Decision engine ◄─────────────┘
        │                  │  (incidents, notifications, risk scores)
        └──────────────────┘
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for data flow, the DB model, the IoT
& RF-mitigation design, the security model, and roles.

---

## The AI layer

The platform strictly separates **AI detection** ("what looks abnormal?") from the
**decision engine** ("what should we do?").

| Detector | Role | Output |
|---|---|---|
| **Battery anomaly** | reconstruction-error deviation + sustained physical severity | score 0–100 |
| **Battery fault** | classify likely fault (overheating / voltage / discharge / sensor) | hedged label |
| **Battery SOH** | weighted-feature state-of-health | 0–100 % |
| **Battery RUL** | remaining useful life (probabilistic) | cycle range + confidence |
| **Theft** | behavioural: rental violation + zone breach + outbound motion + trajectory | score 0–100 |
| **Tampering** | multivariate consistency: moving but signals dropping | score 0–100 |
| **Fuzzy engine** | LOW/MEDIUM/HIGH/CRITICAL membership + rules → defuzzified severity | severity + driver |

Every alert is **explainable** (contributing factors + a "Why?" panel), **hedged**
(never "stolen", always "possible unauthorized movement — confidence X%"), and paired
with a **recommended action**. If `AI_SERVICE_URL` is set the backend calls an external
service; on any failure it falls back to the local engine so the dashboard never goes
dark. Full detail in [`docs/AI.md`](docs/AI.md).

---

## Project structure

```
prisma/            schema.prisma + seed.ts
src/
  app/             Next.js routes
    api/           REST endpoints (auth, vehicles, batteries, hubs, telemetry,
                   incidents, notifications, rentals, reservations, sim, stream…)
    owner/         owner portal pages
    client/        client portal pages
  components/      design-system + feature components
  lib/
    ai/            detectors, fuzzy engine, robust stats, geo  ← the intelligence
    auth.ts        JWT sessions + bcrypt
    booking.ts     availability + business rules
    engine.ts      risk/incident generation
    telemetry.ts   ESP32 ingestion contract
    simulator.ts   per-vehicle physics + scenarios
    sim-manager.ts running fleet loop
    rental-monitor.ts  rental lifecycle sweep
    events.ts      in-process pub/sub (backs SSE)
    i18n/          en/fr/ar dictionaries + provider
tests/             vitest unit tests (AI, stats, booking)
docs/              ARCHITECTURE.md, AI.md, IOT.md, SECURITY.md
```

---

## API reference

Auth: `POST /api/auth/{register,login,logout}`, `GET /api/auth/me`
Vehicles: `GET/POST /api/vehicles`, `GET/PATCH /api/vehicles/:id`
Batteries: `GET /api/batteries`, `GET /api/batteries/:id` (passport)
Hubs: `GET /api/hubs`, `POST /api/hubs/swap`
Telemetry: `POST /api/telemetry` (ESP32 contract), `GET /api/telemetry?vehicleId=`
Rentals/Reservations: `GET /api/rentals`, `GET/POST /api/reservations`,
`PATCH /api/reservations/:id`, `POST /api/reservations/:id/cancel`
Incidents: `GET /api/incidents`, `PATCH /api/incidents/:id`
Notifications: `GET /api/notifications`, `PATCH /api/notifications/:id`
Command center / insights / tracking: `GET /api/{command-center,insights,tracking}`
Realtime: `GET /api/stream` (SSE)
Simulator: `GET/POST /api/sim`, `POST /api/sim/full-demo`

All owner endpoints are role-guarded; clients can only ever see their own data.

---

## Environment variables

See [`.env.example`](.env.example). Key ones:

- `DATABASE_URL` — SQLite file (or a Postgres URL after switching the provider).
- `JWT_SECRET` — **required**; use a long random string in production.
- `AI_SERVICE_URL` — empty = built-in AI; set to delegate to a Python service.
- `MQTT_URL` — empty = in-process simulator.
- Business rules (`RENTAL_ENDING_WARNING_MINUTES`, `BATTERY_CRITICAL_TEMPERATURE`,
  `THEFT_GEOFENCE_RADIUS_KM`, …) are configurable, with sensible defaults.

---

## Testing

```bash
npm test          # vitest run — AI detectors, fuzzy engine, robust stats, booking rules
npm run build     # full type-check + production build
```

---

## Security & privacy

Password hashing (bcrypt), JWT in httpOnly/SameSite cookies, role-based authorization on
every endpoint, Zod input validation, Prisma parameterized queries, audit logging,
secrets in env, no API keys in the frontend, no raw card storage, and **minimal exposure
of CIN/passport data** (owner-only, masked in the UI). Details in
[`docs/SECURITY.md`](docs/SECURITY.md).

---

## Production considerations

- Swap SQLite → Postgres (change `provider` + `DATABASE_URL`; run `prisma migrate`).
- Move the simulator behind an MQTT broker; keep the `EspTelemetry` contract.
- Split the AI layer into a Python/FastAPI service behind `AI_SERVICE_URL` when you have
  real telemetry to train on.
- Add raw-vs-aggregated telemetry retention (schema already separates `Telemetry` from
  battery readings) and DB indexes (already declared on hot query paths).
- Enable Web Push/FCM for real device notifications.
- Put the ingestion + AI inference behind a queue for scale.

The platform **does not overpromise**: it produces risk, probability, anomaly, and
confidence to support a human decision — never a guaranteed theft or failure verdict.
