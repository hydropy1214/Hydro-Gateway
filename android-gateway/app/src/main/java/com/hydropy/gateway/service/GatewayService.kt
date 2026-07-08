package com.hydropy.gateway.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.telephony.SmsManager
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.hydropy.gateway.R
import com.hydropy.gateway.data.AppDatabase
import com.hydropy.gateway.data.Config
import com.hydropy.gateway.data.LocalLog
import com.hydropy.gateway.data.PendingMessage
import com.hydropy.gateway.ui.MainActivity
import com.hydropy.gateway.util.DeviceInfoHelper
import kotlinx.coroutines.*
import okhttp3.*
import java.util.concurrent.TimeUnit

data class WsMessage(val type: String, val data: Map<String, Any?> = emptyMap())

class GatewayService : LifecycleService() {

    companion object {
        const val CHANNEL_ID = "hydropy_gateway"
        const val NOTIFICATION_ID = 1001
        var isRunning = false
        var statusMessage = "Disconnected"
        var connectedDeviceId: Int? = null
    }

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // Keep-alive for WS
        .build()

    private var webSocket: WebSocket? = null
    private var reconnectJob: Job? = null
    private var heartbeatJob: Job? = null
    private var smsWorkerJob: Job? = null
    private var isConnected = false
    private var shouldReconnect = true

    private lateinit var db: AppDatabase

    override fun onCreate() {
        super.onCreate()
        db = AppDatabase.getInstance(this)
        createNotificationChannel()
        isRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        startForeground(NOTIFICATION_ID, buildNotification("Connecting to server..."))
        lifecycleScope.launch { connect() }
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        shouldReconnect = false
        disconnect()
    }

    private suspend fun connect() {
        val serverUrl = db.configDao().get("server_url") ?: return
        val token = db.configDao().get("auth_token") ?: return
        val deviceId = db.configDao().get("device_id") ?: return

        val wsUrl = serverUrl.replace("https://", "wss://").replace("http://", "ws://") + "/ws"
        log("Connecting to $wsUrl")
        updateStatus("Connecting...")

        val request = Request.Builder().url(wsUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnected = true
                log("WebSocket connected, authenticating...")
                // Authenticate
                send(mapOf("type" to "AUTH", "token" to token, "deviceId" to deviceId))
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                lifecycleScope.launch { handleMessage(text) }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                isConnected = false
                log("WebSocket closing: $reason")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                isConnected = false
                log("WebSocket closed")
                updateStatus("Disconnected")
                if (shouldReconnect) scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                isConnected = false
                log("WebSocket error: ${t.message}")
                updateStatus("Connection failed - retrying...")
                if (shouldReconnect) scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = lifecycleScope.launch {
            delay(5_000)
            if (shouldReconnect) connect()
        }
    }

    private suspend fun handleMessage(text: String) {
        try {
            @Suppress("UNCHECKED_CAST")
            val msg = gson.fromJson(text, Map::class.java) as Map<String, Any?>
            when (val type = msg["type"] as? String) {
                "AUTH_OK" -> {
                    val id = (msg["deviceId"] as? Double)?.toInt()
                    connectedDeviceId = id
                    updateStatus("Connected - Ready for SMS")
                    log("Authenticated successfully. Device ID: $id")
                    startHeartbeat()
                    sendDeviceInfo()
                    startSmsWorker()
                }
                "AUTH_FAILED" -> {
                    updateStatus("Authentication failed")
                    log("Authentication failed - check credentials")
                    shouldReconnect = false
                    stopSelf()
                }
                "HEARTBEAT_ACK" -> { /* ok */ }
                "SEND_SMS" -> {
                    val number = msg["number"] as? String ?: return
                    val message = msg["message"] as? String ?: return
                    val smsId = (msg["smsId"] as? Double)?.toInt() ?: -1
                    log("Received SMS job for $number (id=$smsId)")
                    enqueueSms(smsId, number, message)
                }
                "RESTART" -> {
                    log("Restart command received")
                    disconnect()
                    delay(2000)
                    connect()
                }
                else -> log("Unknown message type: $type")
            }
        } catch (e: Exception) {
            log("Error handling message: ${e.message}")
        }
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = lifecycleScope.launch {
            while (isConnected) {
                delay(30_000)
                val info = DeviceInfoHelper.getInfo(this@GatewayService)
                send(mapOf(
                    "type" to "HEARTBEAT",
                    "battery" to info.battery,
                    "signal" to info.signal,
                    "storage" to info.storage
                ))
            }
        }
    }

    private fun sendDeviceInfo() {
        val info = DeviceInfoHelper.getInfo(this)
        send(mapOf(
            "type" to "DEVICE_INFO",
            "phoneModel" to info.model,
            "androidVersion" to info.androidVersion,
            "simInfo" to info.simInfo,
            "battery" to info.battery,
            "signal" to info.signal
        ))
    }

    private fun startSmsWorker() {
        smsWorkerJob?.cancel()
        smsWorkerJob = lifecycleScope.launch {
            while (isConnected) {
                val pending = db.pendingMessageDao().getPending()
                for (msg in pending) {
                    processSms(msg)
                    delay(500) // Rate limiting
                }
                delay(2000)
            }
        }
    }

    private suspend fun processSms(msg: PendingMessage) {
        try {
            db.pendingMessageDao().updateStatus(msg.id, "SENDING", System.currentTimeMillis(), null)
            log("Sending SMS to ${msg.phoneNumber}")

            val success = sendSms(msg.phoneNumber, msg.message)
            val status = if (success) "SUCCESS" else "FAILED"
            val error = if (success) null else "SMS send returned failure"

            db.pendingMessageDao().updateStatus(msg.id, status, System.currentTimeMillis(), error)

            if (msg.smsId > 0) {
                send(mapOf(
                    "type" to "SMS_RESULT",
                    "smsId" to msg.smsId,
                    "status" to status,
                    "error" to error
                ))
            }
            log("SMS to ${msg.phoneNumber}: $status")
        } catch (e: Exception) {
            log("SMS error: ${e.message}")
            db.pendingMessageDao().updateStatus(msg.id, "FAILED", System.currentTimeMillis(), e.message)
            if (msg.smsId > 0) {
                send(mapOf("type" to "SMS_RESULT", "smsId" to msg.smsId, "status" to "FAILED", "error" to e.message))
            }
        }
    }

    private fun sendSms(phoneNumber: String, message: String): Boolean {
        return try {
            val smsManager = getSystemService(SmsManager::class.java)
            val parts = smsManager.divideMessage(message)
            if (parts.size == 1) {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null)
            } else {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            }
            true
        } catch (e: Exception) {
            log("SmsManager error: ${e.message}")
            false
        }
    }

    private suspend fun enqueueSms(smsId: Int, phoneNumber: String, message: String) {
        db.pendingMessageDao().insert(PendingMessage(smsId = smsId, phoneNumber = phoneNumber, message = message))
        // Update status on server immediately
        send(mapOf("type" to "SMS_STATUS", "smsId" to smsId, "status" to "ASSIGNED"))
    }

    private fun send(payload: Map<String, Any?>) {
        webSocket?.send(gson.toJson(payload))
    }

    private fun disconnect() {
        heartbeatJob?.cancel()
        smsWorkerJob?.cancel()
        reconnectJob?.cancel()
        webSocket?.close(1000, "Service stopping")
        isConnected = false
    }

    private fun updateStatus(status: String) {
        statusMessage = status
        val notification = buildNotification(status)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)
    }

    private suspend fun log(message: String) {
        try {
            db.localLogDao().insert(LocalLog(level = "info", message = message))
        } catch (_: Exception) {}
        // Clean old logs weekly
        db.localLogDao().cleanOld(System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000L)
    }

    private fun buildNotification(status: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("HYDROPY Gateway")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "HYDROPY Gateway Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Keeps the SMS gateway running" }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }
}
