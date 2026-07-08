---
name: HYDROPY WebSocket auth fix + dashboard broadcasts + APK build
description: Critical fixes for device connection, real-time dashboard, and APK build on Replit
---

## AUTH fix (was causing "Connecting" loop)
Server previously did `device.deviceId !== deviceId` in AUTH — always fails because:
- `device.deviceId` in DB = Android hardware ID (ANDROID_ID string, e.g. "a1b2c3d4")
- Android app sends the **numeric DB id** as `deviceId` (e.g. "1")

**Fix:** Validate by `authToken` only. Token is 32 random bytes — sufficient.
**Why:** Mismatch → AUTH_FAILED → infinite reconnect → stuck at "Connecting".

## Dashboard real-time events
Dashboard WS connections must send `{ type: "SUBSCRIBE" }` to opt in.
Server only adds to `dashboardSockets` Set after SUBSCRIBE — never on raw connect.
Events pushed: device_connected, device_disconnected, device_updated, device_telemetry, sms_result.

## APK build on Replit
Must use `nix-shell -p jdk17` — GraalVM (default Java 19) fails jlink in Android Gradle plugin.
SDK and Gradle stored in `/tmp/` — wiped on repl restart, must re-run setup each session.
Build: `gradle assembleDebug --no-daemon` (release also works — signingConfig uses debug key).
Copy output to: `artifacts/api-server/apk-storage/HYDROPY-Gateway.apk`

## DB schema
Run `pnpm --filter @workspace/db run push` after first setup or any schema changes.
`app_versions.download_url` is NOT NULL — any direct insert must include this field.
