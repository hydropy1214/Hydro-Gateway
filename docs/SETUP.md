# HYDROPY — Setup Guide

## Overview

HYDROPY is a platform for managing Android phones as SMS gateways. Devices connect over WebSocket and receive SMS jobs dispatched from campaigns or the dashboard.

```
Dashboard (React) ─── API Server (Express/WS) ─── PostgreSQL
                                │
                         WebSocket /ws
                                │
                    Android Gateway (Kotlin)
                         └── SmsManager
```

---

## 1. Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 20+ |
| pnpm | 9+ |
| PostgreSQL | 14+ |
| Android Studio | Hedgehog 2023.1.1+ |

---

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# PostgreSQL connection string (required)
DATABASE_URL=postgresql://user:password@localhost:5432/hydropy

# Session secret — used to derive the API key if HYDROPY_API_KEY is not set
SESSION_SECRET=a-long-random-string-here

# (Optional) Pin the dashboard API key explicitly
HYDROPY_API_KEY=your-40-char-api-key-here

# Port for the API server (set by Replit automatically)
PORT=8080
```

> The API key is printed to the server log on startup if not explicitly set.
> Copy it from the logs for use in the dashboard and any API calls.

---

## 3. Install & Start

```bash
# Install all dependencies
pnpm install

# Push database schema (first time or after schema changes)
pnpm run db:push

# Start both API server and dashboard in dev mode
pnpm run dev
```

The dashboard is available at **`/`** and the API at **`/api`**.

---

## 4. Connect an Android Device

1. Open the dashboard → **Devices** → **Generate Pair Code**
2. Note the 6-character code (expires in 10 minutes)
3. On the Android phone:
   - Install the HYDROPY Gateway APK (from **APK Manager** page)
   - Enter your server URL and the pair code
   - Tap **CONNECT DEVICE**
   - Grant SMS and Phone permissions
4. The device appears as **Online** in the dashboard

---

## 5. Run a Campaign

1. Go to **Campaigns** → **New Campaign**
2. Enter a name and message template
3. Paste your contact list as JSON:
   ```json
   [
     { "phoneNumber": "+1234567890", "name": "Alice" },
     { "phoneNumber": "+0987654321" }
   ]
   ```
4. Click **Create** then **Start**
5. SMS jobs are distributed to online devices and results stream back in real-time

---

## 6. API Authentication

All API endpoints (except `/api/healthz` and `/api/devices/pair`) require an API key:

```bash
curl -H "X-API-Key: YOUR_KEY" https://your-server.com/api/dashboard/stats
# or
curl -H "Authorization: Bearer YOUR_KEY" https://your-server.com/api/dashboard/stats
```

The key is shown in the server startup logs as:
```
INFO  API key initialised (length=40)
WARN  HYDROPY_API_KEY not set — key derived from SESSION_SECRET
```

Set `HYDROPY_API_KEY` in your environment to fix the key permanently across restarts.
