# HYDROPY Gateway - Android App

Native Kotlin Android SMS gateway application for the HYDROPY platform.

## Requirements

- Android Studio Hedgehog (2023.1.1) or newer
- Android SDK 35
- JDK 11+
- Kotlin 2.0.21

## Build Instructions

### 1. Open in Android Studio

```
File > Open > android-gateway/
```

### 2. Sync Gradle

Allow Android Studio to sync Gradle dependencies automatically.

### 3. Build APK

```
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

Output: `app/build/outputs/apk/debug/HYDROPY-Gateway.apk`

### Release Build

```
Build > Generate Signed Bundle / APK > APK > release
```

Output: `app/build/outputs/apk/release/HYDROPY-Gateway.apk`

### Command Line Build

```bash
cd android-gateway
./gradlew assembleRelease
```

The APK will be at: `app/build/outputs/apk/release/HYDROPY-Gateway.apk`

## How to Use

1. **Install APK** on Android phone (allow unknown sources)
2. **Open app** — HYDROPY Gateway screen appears
3. **Enter Server URL**: `https://your-server.com`
4. **Get Pair Code** from Dashboard → Devices → Generate Pair Code
5. **Enter Pair Code** in the app
6. **Tap CONNECT DEVICE**
7. Grant SMS and Phone permissions when prompted
8. Device appears as **Online** in the dashboard

## Architecture

```
GatewayService (Foreground Service)
├── WebSocket client (OkHttp) → connects to /ws
├── SMS Worker → reads pending queue, sends via SmsManager
├── Heartbeat → every 30s sends battery/signal info
└── Auto-reconnect → 5s backoff on disconnect

AppDatabase (Room)
├── PendingMessage — SMS jobs received from server
├── Config — server URL, auth token, device ID
└── LocalLog — recent activity logs

BootReceiver — auto-starts service on device boot
```

## WebSocket Protocol

### Client → Server

```json
// Authentication (first message after connect)
{ "type": "AUTH", "token": "...", "deviceId": "android-device-id" }

// Heartbeat (every 30s)
{ "type": "HEARTBEAT", "battery": 85, "signal": -70 }

// SMS result
{ "type": "SMS_RESULT", "smsId": 123, "status": "SUCCESS" }
{ "type": "SMS_RESULT", "smsId": 124, "status": "FAILED", "error": "No SIM card" }

// Device info
{ "type": "DEVICE_INFO", "phoneModel": "Pixel 7", "androidVersion": "Android 14", "simInfo": "Verizon (Ready)" }
```

### Server → Client

```json
// Auth confirmed
{ "type": "AUTH_OK", "deviceId": 42 }

// Send SMS command
{ "type": "SEND_SMS", "number": "+1234567890", "message": "Hello World", "smsId": 123 }

// Restart connection
{ "type": "RESTART" }

// Heartbeat ack
{ "type": "HEARTBEAT_ACK" }
```

## Permissions Required

- `SEND_SMS` — to send text messages
- `READ_PHONE_STATE` — to get SIM information
- `INTERNET` — to connect to server
- `FOREGROUND_SERVICE` — to run as background service
- `RECEIVE_BOOT_COMPLETED` — to auto-start on boot
- `POST_NOTIFICATIONS` — for persistent notification (Android 13+)
