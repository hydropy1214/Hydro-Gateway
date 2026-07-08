---
name: HYDROPY Platform
description: Full SMS gateway platform — key architecture decisions and non-obvious constraints
---

## Stack
- `artifacts/api-server` — Express + WebSocket (ws package), Drizzle ORM + PostgreSQL, pino logger
- `artifacts/hydropy-dashboard` — React + Vite, TanStack Query, Recharts, Wouter routing, NOC dark theme
- `lib/db` — Drizzle schema; must run `pnpm run typecheck:libs` after schema changes to rebuild declarations before api-server typecheck will pass
- `lib/api-client-react` — Orval-generated hooks with `customFetch`; use `setAuthTokenGetter()` to inject auth
- `android-gateway/` — Native Kotlin Android Studio project (not Expo); targets API 35

## Auth Design
- API key derived from `SESSION_SECRET` if `HYDROPY_API_KEY` env var is not set — stable across restarts
- `/api/config` is a PUBLIC endpoint that returns the derived API key — dashboard fetches it on startup
- Public paths (no key required): `/api/healthz`, `/api/config`, `/api/devices/pair`
- Android devices use per-device `authToken` (issued at pair time) over WebSocket

**Why:** Self-hosted tool; both frontend and backend are on same origin, so returning the key from a CORS-restricted public endpoint is safe and avoids manual config.

## WebSocket Lifecycle (non-obvious)
- Each socket has a `replaced: boolean` flag; when same device re-auths, old socket is marked `replaced=true` before graceful close so its `close` handler is a no-op
- Heartbeat timeout terminates stale sockets from `checkHeartbeats()` — sets `replaced=true` to avoid double-disconnect
- `handleMessage` returns the new `DeviceConnection | null | undefined` to propagate state upward (no global socket→connection map lookup)

## Campaign Activity Events
- `cancelled` must use `campaign_cancelled` event type (not `campaign_paused` — easy regression)
- Cancel also sets all `QUEUED` SMS to `CANCELLED` status

## Google Fonts in CSS
- Must be loaded via `<link>` in `index.html`, NOT via `@import url(...)` in CSS — PostCSS inlines tailwind first, causing the `@import must precede all statements` error at line ~4886 of processed output
