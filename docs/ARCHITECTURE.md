# HYDROPY — Architecture Overview

## Repository Structure

```
hydropy/
├── artifacts/
│   ├── api-server/          # Node.js/Express backend + WebSocket server
│   │   └── src/
│   │       ├── index.ts         # HTTP server entry point
│   │       ├── app.ts           # Express setup, CORS, auth middleware
│   │       ├── websocket.ts     # HydroWss — WebSocket gateway manager
│   │       ├── middleware/
│   │       │   └── auth.ts      # API key middleware
│   │       └── routes/
│   │           ├── dashboard.ts # GET /api/dashboard/stats
│   │           ├── devices.ts   # CRUD + pair + WS commands
│   │           ├── campaigns.ts # Campaign lifecycle + contacts
│   │           ├── sms.ts       # SMS queue
│   │           ├── apk.ts       # APK version management
│   │           ├── activity.ts  # Activity feed
│   │           ├── logs.ts      # API + WebSocket log tails
│   │           └── system.ts    # Health check
│   └── hydropy-dashboard/   # React + Vite dashboard (NOC theme)
│       └── src/
│           ├── pages/           # Dashboard, Devices, Campaigns, SMS, Logs …
│           ├── hooks/
│           │   └── useWebSocket.ts  # Real-time event subscription
│           └── components/
│               └── layout/      # Shell, Sidebar
├── lib/
│   ├── db/                  # Drizzle ORM + PostgreSQL schema
│   │   └── src/schema/
│   │       ├── devices.ts       # devices, device_sessions, pair_codes
│   │       ├── campaigns.ts     # campaigns, contacts
│   │       ├── sms.ts           # sms_messages, sms_logs
│   │       ├── logs.ts          # device_logs, system_logs, activity_events
│   │       └── apk_versions.ts  # app_versions
│   ├── api-spec/            # OpenAPI 3.1 spec (source of truth)
│   ├── api-client-react/    # Generated React Query hooks (Orval)
│   └── api-zod/             # Generated Zod schemas (Orval)
└── android-gateway/         # Native Kotlin Android Studio project
    └── app/src/main/java/com/hydropy/gateway/
        ├── service/
        │   ├── GatewayService.kt   # Foreground service (WS + SMS)
        │   └── BootReceiver.kt     # Auto-start on boot
        ├── ui/
        │   └── MainActivity.kt     # Setup / pairing UI
        └── data/
            └── AppDatabase.kt      # Room DB (pending msgs, config, logs)
```

---

## WebSocket Protocol

Devices connect to `wss://<host>/ws` after pairing. The conversation:

```
Android                          Server
   │── AUTH {token, deviceId} ──►│  lookup token → mark online
   │◄── AUTH_OK {deviceId} ──────│
   │
   │── DEVICE_INFO {model, …} ──►│  store phone metadata
   │
   │       every 30 seconds:
   │── HEARTBEAT {battery, …} ──►│
   │◄── HEARTBEAT_ACK ───────────│
   │
   │◄── SEND_SMS {number, msg} ──│  campaign worker dispatches
   │── SMS_RESULT {status} ──────►│  update DB + activity feed
   │
   │◄── RESTART ─────────────────│  reconnect cycle
```

### Connection Lifecycle Guarantees

- **Auth replacement**: if a device re-authenticates (e.g. app restart), the old socket is marked `replaced=true` and closed gracefully. Its `close` event is ignored so it does not incorrectly mark the device offline.
- **Heartbeat timeout**: if no heartbeat is received for >90 seconds, the server terminates the connection and marks the device offline.
- **Reconnect**: the Android app retries with 5-second backoff on any disconnect.

---

## Data Flow — SMS Campaign

```
User clicks "Start Campaign"
  └─► POST /api/campaigns/:id/start
        ├─ queues contacts as sms_messages (status=QUEUED)
        └─ sets campaign status=running

Campaign worker (future: background job; currently: WS dispatch on-demand)
  └─► sendToDevice(deviceId, SEND_SMS) via WebSocket
        ├─ Android enqueues in Room DB
        └─ Android sends via SmsManager

Android reports back
  └─► WS: SMS_RESULT {smsId, status}
        ├─ updates sms_messages.status
        ├─ inserts activity_event (sms_sent / sms_failed)
        └─ increments campaign sent/failed counters
```

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Dashboard → API | API key in `X-API-Key` or `Authorization: Bearer` header |
| Android → WebSocket | Long-lived auth token issued at pair time (per-device) |
| Pair code | 6-char, 10-minute TTL, single-use, server-generated |
| CORS | Locked to same-origin in production (`ALLOWED_ORIGIN` env var) |
| SQL injection | Drizzle ORM query builder (parameterized; no raw interpolation) |

---

## Database Schema (key tables)

| Table | Purpose |
|-------|---------|
| `devices` | Registered Android phones (status, battery, signal, auth token) |
| `pair_codes` | Short-lived codes used to register new devices |
| `campaigns` | Bulk SMS jobs (progress counters, lifecycle state) |
| `contacts` | Per-campaign phone number list |
| `sms_messages` | Individual SMS jobs (status, result, timestamps) |
| `activity_events` | Human-readable timeline of platform events |
| `system_logs` | API and WebSocket request logs |
| `device_logs` | Per-device diagnostic logs |
| `app_versions` | APK release history |
