# HYDROPY Platform

SMS gateway platform — send campaigns via Android phones as gateways. A NOC dashboard controls devices, campaigns, and the SMS queue; Android devices connect via WebSocket and send SMS on command.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port from $PORT, dev default 8080)
- `pnpm --filter @workspace/hydropy-dashboard run dev` — React dashboard (dev)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to dev Postgres

## Building the Android APK

Requires Java 17 + Android SDK (set up via the scripts below — done once):

```bash
# 1. Download Android cmdline-tools & install SDK components (one-time)
curl -L -o /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip /tmp/cmdline-tools.zip -d /tmp/android-sdk/cmdline-tools-raw
mkdir -p /tmp/android-sdk/cmdline-tools/latest
mv /tmp/android-sdk/cmdline-tools-raw/cmdline-tools/* /tmp/android-sdk/cmdline-tools/latest/
nix-shell -p jdk17 --run "
  export ANDROID_HOME=/tmp/android-sdk
  export PATH=\$ANDROID_HOME/cmdline-tools/latest/bin:\$PATH
  yes | sdkmanager --licenses > /dev/null
  sdkmanager 'platform-tools' 'build-tools;35.0.0' 'platforms;android-35'
"

# 2. Download Gradle 8.7 (one-time)
curl -L -o /tmp/gradle-8.7.zip https://services.gradle.org/distributions/gradle-8.7-bin.zip
unzip /tmp/gradle-8.7.zip -d /tmp/

# 3. Build APK
cd android-gateway && nix-shell -p jdk17 --run "
  export GRADLE_HOME=/tmp/gradle-8.7
  export ANDROID_HOME=/tmp/android-sdk
  export GRADLE_USER_HOME=/tmp/gradle-home
  export PATH=\$GRADLE_HOME/bin:\$ANDROID_HOME/cmdline-tools/latest/bin:\$PATH
  gradle assembleRelease --no-daemon
"

# 4. Copy APK to API server storage (makes it downloadable from the dashboard)
cp android-gateway/app/build/outputs/apk/release/HYDROPY-Gateway.apk artifacts/api-server/apk-storage/
```

Output APK is served at **GET /api/apk/latest/download** (public, no auth needed).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + WebSocket (ws package)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Dashboard: React + Vite, TanStack Query, Recharts, Wouter, shadcn/ui
- Android: Native Kotlin (API 35), OkHttp WebSocket, Room DB

## Where things live

- `artifacts/api-server/` — Express + WS backend
- `artifacts/hydropy-dashboard/` — React NOC dashboard
- `android-gateway/` — Native Kotlin Android Studio project (not Expo)
- `lib/db/` — Drizzle schema (source of truth for DB shape)
- `lib/api-spec/` — OpenAPI spec + Orval config
- `lib/api-client-react/` — Orval-generated hooks
- `artifacts/api-server/apk-storage/` — Built APK served for download

## Architecture decisions

- API key is derived from `SESSION_SECRET` if `HYDROPY_API_KEY` is unset — stable across restarts
- `/api/config` is a **public** endpoint returning the derived API key — dashboard self-configures on startup
- APK download routes `/api/apk/latest/download` and `/api/apk/:id/download` are **public** — no auth needed to install the gateway app
- Android uses per-device `authToken` (issued at pair time) over WebSocket — devices authenticate before receiving SMS jobs
- WebSocket sockets have a `replaced` flag to avoid double-disconnect when a device reconnects
- Android build files use Kotlin DSL (`.gradle.kts`) — do not rename to `.gradle` (Groovy DSL)

## Required env vars

- `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)
- `SESSION_SECRET` — used to derive the API key (set as a secret)

## User preferences

_Populate as you build._

## Gotchas

- Run `pnpm run typecheck:libs` after schema changes before api-server typecheck will pass
- Google Fonts must be loaded via `<link>` in `index.html`, NOT via `@import` in CSS (PostCSS processes tailwind first, causing import order errors)
- `cancelled` campaigns must emit `campaign_cancelled` event type (not `campaign_paused`)
- Android SDK and Gradle downloads live in `/tmp/` — they are wiped on repl restart; re-run the setup script above if needed
