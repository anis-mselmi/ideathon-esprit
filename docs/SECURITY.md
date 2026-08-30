# Security & privacy model

## Authentication
- Passwords hashed with **bcrypt** (10 rounds).
- Sessions are **JWT** (`jose`, HS256, 7-day expiry) stored in an **httpOnly, SameSite=Lax**
  cookie, `Secure` in production. No token is exposed to JavaScript.

## Authorization (RBAC)
- Every API route calls `requireUser(role)`; owner-only endpoints reject clients (403).
- The SSE stream filters events by role — clients receive **only their own** notifications.
- Clients can never reach fleet data, telemetry, AI internals, or other clients' records.

## Input validation & data access
- Request bodies validated with **Zod**; malformed input → 422.
- All DB access is through **Prisma** (parameterized) — no string-built SQL, so SQL
  injection is not reachable.
- React escapes output by default (XSS); no `dangerouslySetInnerHTML` on user data.

## Privacy of sensitive identity (CIN / passport)
- Collected **minimally** (only at booking), stored on the user profile.
- Shown **only to the owner** for rental verification, and **masked** in the UI
  (`CIN ····5678`).
- Never returned to other clients or embedded in client-facing responses.
- Retention is configurable; an `AuditLog` records access-worthy actions.

## Secrets & config
- All secrets via environment variables (`JWT_SECRET`, DB URL, service URLs).
- No API keys in the frontend bundle.

## Payments
- Mock flow only — **no raw card data is ever collected or stored**; a mock reference is
  recorded for online payments.

## Auditing
- `AuditLog` captures logins, registrations, vehicle/battery/incident changes, battery
  swaps, and reservation lifecycle events with actor + entity + metadata.

## Transport & hardening (production)
- Serve over HTTPS (encryption in transit); set `Secure` cookies.
- Add rate limiting + CORS allow-list at the edge, and encryption at rest for the DB
  volume where the platform requires it.
- Authenticate hardware telemetry with a per-device token on `POST /api/telemetry`.

## Responsible framing
The system supports human decisions. It reports **risk / probability / anomaly /
confidence** and recommended actions — it never declares a vehicle "stolen" or a battery
"failed", and it surfaces low confidence rather than manufacturing certainty.
