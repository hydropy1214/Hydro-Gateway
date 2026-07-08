package com.hydropy.gateway.util

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat

data class DeviceInfo(
    val model: String,
    val androidVersion: String,
    val simInfo: String,
    val phoneNumber: String?,   // null if carrier doesn't expose it
    val battery: Int,
    val signal: Int,            // dBm, or -1 if unknown
    val storage: Long           // free bytes
)

object DeviceInfoHelper {

    fun getInfo(context: Context): DeviceInfo {
        val model = "${Build.MANUFACTURER} ${Build.MODEL}"
        val androidVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"

        val telephonyManager =
            context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

        val hasPhonePermission = ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED

        val hasPhoneNumberPermission = ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_PHONE_NUMBERS
        ) == PackageManager.PERMISSION_GRANTED

        // ── SIM / Carrier info ─────────────────────────────────────────────────
        val simInfo = if (hasPhonePermission) {
            try {
                val operator = telephonyManager.networkOperatorName?.takeIf { it.isNotBlank() } ?: "Unknown"
                val simState = when (telephonyManager.simState) {
                    TelephonyManager.SIM_STATE_READY  -> "Ready"
                    TelephonyManager.SIM_STATE_ABSENT -> "Absent"
                    else                               -> "Unknown"
                }
                "$operator ($simState)"
            } catch (_: Exception) { "Unknown" }
        } else "No permission"

        // ── Phone number (SIM line 1) ──────────────────────────────────────────
        // Not always available — many carriers don't provision this in the SIM.
        val phoneNumber: String? = if (hasPhonePermission || hasPhoneNumberPermission) {
            try {
                @Suppress("HardwareIds")
                val num = telephonyManager.line1Number?.takeIf { it.isNotBlank() && it != "null" }
                // Normalize to E.164-ish if it's just digits
                num?.let {
                    if (it.startsWith("+")) it
                    else if (it.length >= 10) "+$it"
                    else null
                }
            } catch (_: Exception) { null }
        } else null

        // ── Battery ────────────────────────────────────────────────────────────
        val batteryIntent = context.registerReceiver(
            null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        )
        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val battery = if (level >= 0 && scale > 0) (level * 100 / scale) else -1

        // ── Signal strength ────────────────────────────────────────────────────
        val signal = getSignalDbm(telephonyManager, hasPhonePermission)

        // ── Storage ────────────────────────────────────────────────────────────
        val freeBytes = try {
            val stat = StatFs(Environment.getExternalStorageDirectory().path)
            stat.availableBlocksLong * stat.blockSizeLong
        } catch (_: Exception) { 0L }

        return DeviceInfo(model, androidVersion, simInfo, phoneNumber, battery, signal, freeBytes)
    }

    /**
     * Best-effort signal strength in dBm. Returns -1 if unavailable.
     *
     * On API 29+ we use [TelephonyManager.getSignalStrength] which returns a
     * [android.telephony.SignalStrength] object. On older devices we fall back to
     * the GSM signal strength field (0..31 ASU → approx dBm = asu * 2 - 113).
     */
    @Suppress("DEPRECATION")
    private fun getSignalDbm(tm: TelephonyManager, hasPermission: Boolean): Int {
        if (!hasPermission) return -1
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val ss = tm.signalStrength ?: return -1
                // getLevel() returns 0..4; approximate dBm from cell signal levels
                // getCellSignalStrengths() gives per-technology details
                val cells = ss.cellSignalStrengths
                cells.firstOrNull()?.dbm ?: -1
            } else {
                // Legacy: GSM signal 0..31 ASU; 99 = unknown
                val asu = tm.getNeighboringCellInfo()
                    ?.firstOrNull()?.rssi ?: 99
                if (asu in 0..31) asu * 2 - 113 else -1
            }
        } catch (_: Exception) { -1 }
    }
}
