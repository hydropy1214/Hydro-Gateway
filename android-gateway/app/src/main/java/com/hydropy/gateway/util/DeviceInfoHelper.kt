package com.hydropy.gateway.util

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.telephony.TelephonyManager
import android.telephony.SignalStrength
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

data class DeviceInfo(
    val model: String,
    val androidVersion: String,
    val simInfo: String,
    val battery: Int,
    val signal: Int,
    val storage: Long // free bytes
)

object DeviceInfoHelper {
    fun getInfo(context: Context): DeviceInfo {
        val model = "${Build.MANUFACTURER} ${Build.MODEL}"
        val androidVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"

        // SIM info
        val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        val simInfo = try {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
                val operator = telephonyManager.networkOperatorName ?: "Unknown"
                val simState = when (telephonyManager.simState) {
                    TelephonyManager.SIM_STATE_READY -> "Ready"
                    TelephonyManager.SIM_STATE_ABSENT -> "Absent"
                    else -> "Unknown"
                }
                "$operator ($simState)"
            } else {
                "No permission"
            }
        } catch (e: Exception) { "Unknown" }

        // Battery
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val battery = if (level >= 0 && scale > 0) (level * 100 / scale) else -1

        // Storage
        val stat = StatFs(Environment.getExternalStorageDirectory().path)
        val freeBytes = stat.availableBlocksLong * stat.blockSizeLong

        return DeviceInfo(model, androidVersion, simInfo, battery, -1, freeBytes)
    }
}
