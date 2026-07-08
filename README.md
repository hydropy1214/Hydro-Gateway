# HYDROPY

**Bulk SMS gateway platform** — route SMS campaigns through Android phones connected over WebSocket. A NOC-style dashboard controls devices, campaigns, and the message queue in real time.

---

## How It Works

```
Dashboard (React) ──── API Server (Express + WebSocket) ──── PostgreSQL
                                      │
                               wss://.../api/ws
                                      │
                          Android Gateway (Kotlin app)
                               └── SmsManager (SIM)
```

1. Install the **HYDROPY Gateway APK** on an Android phone
2. Pair the phone with the dashboard using a one-time code
3. The phone connects over WebSocket and stays online as a gateway node
4. Send a campaign — SMS jobs are dispatched to the phone, sent via the SIM, and results stream back

---

## Project Structure

```
hydropy/
├── artifacts/
│   ├── api-server/              # Express 5 + WebSocket backend  (port $PORT)
│   │   ├── src/
│   │   │   ├── index.ts         # HTTP server entry point
│   │   │   ├── app.ts           # Express setup, CORS, auth middleware
│   │   │   ├── websocket.ts     # HydroWss — WebSocket gateway manager
│   │   │   ├── middleware/auth.ts
│   │   │   └── routes/
│   │   │       ├── dashboard.ts # GET /api/dashboard/stats
│   │   │       ├── devices.ts   # CRUD + pair + WS commands
│   │   │       ├── campaigns.ts # Campaign lifecycle + contacts
│   │   │       ├── sms.ts       # SMS queue
│   │   │       ├── apk.ts       # APK download distribution
│   │   │       ├── activity.ts  # Activity feed
│   │   │       ├── logs.ts      # API + WebSocket log tails
│   │   │       └── system.ts   # Health check
│   │   └── apk-storage/         # Built APK served for download
│   │       └── HYDROPY-Gateway.apk
│   └── hydropy-dashboard/       # React + Vite NOC dashboard  (preview /)
│       └── src/
│           ├── pages/           # Dashboard, Devices, Campaigns, SmsQueue, ApkManager …
│           ├── hooks/useWebSocket.ts
│           └── components/layout/
├── lib/
│   ├── db/                      # Drizzle ORM + PostgreSQL schema (source of truth)
│   │   └── src/schema/
│   │       ├── devices.ts       # devices, pair_codes
│   │       ├── campaigns.ts     # campaigns, contacts
│   │       ├── sms.ts           # sms_messages
│   │       ├── logs.ts          # device_logs, system_logs, activity_events
│   │       └── apk_versions.ts  # app_versions
│   ├── api-spec/                # OpenAPI 3.1 spec (source of truth for API shape)
│   ├── api-client-react/        # Orval-generated React Query hooks
│   └── api-zod/                 # Orval-generated Zod schemas
└── android-gateway/             # Native Kotlin Android app (Android Studio project)
    └── app/src/main/java/com/hydropy/gateway/
        ├── service/
        │   ├── GatewayService.kt    # Foreground service: WebSocket + SMS worker
        │   └── BootReceiver.kt      # Auto-start on phone reboot
        ├── ui/MainActivity.kt       # Pairing UI
        └── data/AppDatabase.kt      # Room DB: pending messages, config, logs
```

---

## Running on Replit

Both services start automatically via workflows:

| Workflow | What it runs |
|----------|-------------|
| `artifacts/api-server: API Server` | API + WebSocket backend |
| `artifacts/hydropy-dashboard: web` | React dashboard |

**Required environment variables** (set as Replit Secrets):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (auto-provisioned by Replit) |
| `SESSION_SECRET` | Used to derive the API key if `HYDROPY_API_KEY` is not set |

The dashboard self-configures — it fetches the API key from `/api/config` on startup.

---

## Local Development

```bash
# Install all dependencies
pnpm install

# Push database schema (first time or after schema changes)
pnpm --filter @workspace/db run push

# Start API server (dev mode with auto-rebuild)
pnpm --filter @workspace/api-server run dev

# Start dashboard (separate terminal)
pnpm --filter @workspace/hydropy-dashboard run dev

# Regenerate API hooks from OpenAPI spec after spec changes
pnpm --filter @workspace/api-spec run codegen

# Full typecheck
pnpm run typecheck
```

---

## Connecting an Android Device

1. Open the dashboard → **Devices** → **Pair New Device** → Generate Code
2. Note the 6-character code (expires in 10 minutes) and the server URL shown
3. On the Android phone:
   - Download the APK from **APK Manager** in the dashboard
   - Enable **Unknown sources** in Settings if prompted
   - Open the APK and install it
   - Launch **HYDROPY Gateway**
   - Enter the server URL and pair code
   - Tap **CONNECT DEVICE** and grant all permissions
4. The device appears as **Online** in the dashboard

---

## Running a Campaign

1. **Campaigns** → **New Campaign**
2. Enter a name and message text
3. Upload contacts as JSON:
   ```json
   [
     { "phoneNumber": "+1234567890", "name": "Alice" },
     { "phoneNumber": "+0987654321" }
   ]
   ```
4. Click **Create** → **Start**
5. Jobs are dispatched to online devices, sent via the SIM, and results stream back in real time

---

## WebSocket Protocol

```
Android Device                     Server
   │── AUTH {token, deviceId} ───►│  verify token → mark online
   │◄── AUTH_OK {deviceId} ───────│
   │── DEVICE_INFO {model, …} ───►│  store hardware metadata
   │
   │     every 25 seconds:
   │── HEARTBEAT {battery, …} ───►│
   │◄── HEARTBEAT_ACK ────────────│
   │
   │◄── SEND_SMS {number, msg} ───│  dispatched by campaign worker
   │── SMS_RESULT {status} ───────►│  update DB + activity feed
   │
   │◄── RESTART ──────────────────│  remote reconnect command
```

- Devices authenticate with a 32-byte token issued at pair time
- Heartbeat timeout: device marked **Offline** after 90 seconds of silence
- Reconnect: exponential backoff starting at 3 seconds, capping at 30 seconds

---

## Security

| Layer | Mechanism |
|-------|-----------|
| Dashboard → API | API key in `Authorization: Bearer` or `X-API-Key` header |
| Android → WebSocket | Per-device auth token (32 random bytes, issued at pair time) |
| Pair code | 6 chars, 10-minute TTL, single-use |
| CORS | Locked to same origin in production (`ALLOWED_ORIGIN` env var) |

The API key is derived from `SESSION_SECRET` if `HYDROPY_API_KEY` is not set — stable across restarts.

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `devices` | Registered Android phones — status, battery, signal, auth token |
| `pair_codes` | Short-lived codes for registering new devices |
| `campaigns` | Bulk SMS jobs with progress counters and lifecycle state |
| `contacts` | Per-campaign phone number list |
| `sms_messages` | Individual SMS jobs — status, result, timestamps |
| `activity_events` | Human-readable timeline of platform events |
| `system_logs` | API and WebSocket request logs |
| `device_logs` | Per-device diagnostic logs |
| `app_versions` | APK release history |

---

## APK — Android Gateway App

The prebuilt APK is available for download directly from the dashboard (**APK Manager** page) at:

```
GET /api/apk/latest/download   ← no auth required
```

**Permissions the app requires:**

| Permission | Reason |
|------------|--------|
| `SEND_SMS` | Send text messages via the SIM |
| `READ_PHONE_STATE` | Read SIM/carrier info for telemetry |
| `INTERNET` | Connect to the HYDROPY server |
| `FOREGROUND_SERVICE` | Stay running in the background |
| `RECEIVE_BOOT_COMPLETED` | Auto-start after phone reboot |
| `POST_NOTIFICATIONS` | Show persistent status notification (Android 13+) |

**Troubleshooting:**

- *Device stuck at "Connecting"* — delete app data and re-pair with a fresh code; make sure the server URL has no trailing slash
- *SMS not sending* — confirm `SEND_SMS` permission is granted; check for carrier SIM restrictions
- *Device shows Offline after reboot* — disable battery optimization for HYDROPY Gateway in phone Settings
- *Build fails (SDK error)* — ensure Android SDK 35 is installed in Android Studio → SDK Manager

### Building the APK yourself (Android Studio)

```
File → Open → android-gateway/
Build → Build Bundle(s) / APK(s) → Build APK(s)
```

Output: `android-gateway/app/build/outputs/apk/debug/HYDROPY-Gateway.apk`

Copy it to `artifacts/api-server/apk-storage/HYDROPY-Gateway.apk` to serve it from the dashboard.

### Building via command line (Replit / CI)

```bash
# One-time setup
curl -L -o /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip /tmp/cmdline-tools.zip -d /tmp/android-sdk/cmdline-tools-raw
mkdir -p /tmp/android-sdk/cmdline-tools/latest
mv /tmp/android-sdk/cmdline-tools-raw/cmdline-tools/* /tmp/android-sdk/cmdline-tools/latest/
curl -L -o /tmp/gradle-8.7.zip https://services.gradle.org/distributions/gradle-8.7-bin.zip
unzip /tmp/gradle-8.7.zip -d /tmp/

export ANDROID_HOME=/tmp/android-sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
yes | sdkmanager --licenses > /dev/null
sdkmanager "platform-tools" "build-tools;35.0.0" "platforms;android-35"

# Build
cd android-gateway
export GRADLE_HOME=/tmp/gradle-8.7
export GRADLE_USER_HOME=/tmp/gradle-home
export PATH=$GRADLE_HOME/bin:$PATH
gradle assembleDebug --no-daemon

# Deploy to dashboard
cp app/build/outputs/apk/debug/HYDROPY-Gateway.apk \
   ../artifacts/api-server/apk-storage/HYDROPY-Gateway.apk
```

---

## User Preferences

- Keep the Android build files in Kotlin DSL (`.gradle.kts`) — do not rename to `.gradle`
- Google Fonts must be loaded via `<link>` in `index.html`, not via `@import` in CSS
- Run `pnpm run typecheck:libs` after schema changes before the api-server typecheck will pass
