# HYDROPY Gateway — APK Build Instructions

The Android project lives in `android-gateway/`. You need Android Studio to build it.

## Quick Start

### 1. Open the Project

```
Android Studio → File → Open → android-gateway/
```

Allow Gradle to sync (downloads dependencies, ~2 min first run).

### 2. Debug Build (for testing)

```
Build → Build Bundle(s) / APK(s) → Build APK(s)
```

Output: `android-gateway/app/build/outputs/apk/debug/HYDROPY-Gateway.apk`

### 3. Release Build

```
Build → Generate Signed Bundle / APK → APK → release
```

You'll need a keystore. Create one:
```
Build → Generate Signed Bundle / APK → Create new...
```

Output: `android-gateway/app/build/outputs/apk/release/HYDROPY-Gateway.apk`

### 4. Command Line (CI/CD)

```bash
cd android-gateway

# Debug
./gradlew assembleDebug

# Release (requires keystore)
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=/path/to/keystore.jks \
  -Pandroid.injected.signing.store.password=STORE_PASSWORD \
  -Pandroid.injected.signing.key.alias=KEY_ALIAS \
  -Pandroid.injected.signing.key.password=KEY_PASSWORD
```

---

## Upload APK to Dashboard

After building, upload via the API so it appears in the APK Manager:

```bash
curl -X POST https://your-server.com/api/apk/versions \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0.0",
    "filename": "HYDROPY-Gateway.apk",
    "changelog": "Initial release",
    "isLatest": true
  }'
```

Then upload the actual file:
```bash
curl -X POST https://your-server.com/api/apk/upload \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "file=@HYDROPY-Gateway.apk"
```

---

## Install on Device

1. Transfer APK to the device (USB, email, or web download)
2. On device: **Settings → Security → Allow unknown sources**  
   (or per-app: when prompted during install, tap "Settings" → enable)
3. Open the APK file → Install
4. Launch **HYDROPY Gateway**
5. Enter the server URL and pair code from the dashboard

---

## Permissions Explained

| Permission | Why |
|------------|-----|
| `SEND_SMS` | Core function: send text messages |
| `READ_PHONE_STATE` | Read SIM carrier/state for device info |
| `INTERNET` | Connect to your HYDROPY server |
| `FOREGROUND_SERVICE` | Keep the gateway running in background |
| `RECEIVE_BOOT_COMPLETED` | Auto-start after phone reboot |
| `POST_NOTIFICATIONS` (Android 13+) | Show persistent "Gateway Running" notification |

---

## Troubleshooting

**SMS not sending**
- Check the device is `Online` in the dashboard
- Ensure `SEND_SMS` permission is granted (Settings → Apps → HYDROPY Gateway → Permissions)
- Check for carrier restrictions on the SIM

**Device shows as Offline after restart**
- Ensure `RECEIVE_BOOT_COMPLETED` permission is granted
- On some OEMs (Xiaomi, Samsung), disable battery optimization for HYDROPY Gateway

**Authentication failed**
- Delete the app data and re-pair with a fresh pair code
- Ensure the server URL doesn't have a trailing slash

**Build fails with SDK error**
- Ensure Android SDK 35 is installed: Android Studio → SDK Manager → Android 15
