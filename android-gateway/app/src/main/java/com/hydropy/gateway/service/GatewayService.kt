package com.hydropy.gateway.service

import android.app.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder
import android.telephony.SmsManager
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.hydropy.gateway.data.AppDatabase
import com.hydropy.gateway.data.LocalLog
import com.hydropy.gateway.data.PendingMessage
import com.hydropy.gateway.ui.MainActivity
import com.hydropy.gateway.util.DeviceInfoHelper
import kotlinx.coroutines.*
import okhttp3.*
import java.util.Collections
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class GatewayService : LifecycleService() {

    companion object {
        const val CHANNEL_ID      = "hydropy_gateway"
        const val NOTIFICATION_ID = 1001
        const val SMS_SENT_ACTION = "com.hydropy.gateway.SMS_SENT"

        @Volatile var isRunning          = false
        @Volatile var statusMessage      = "Disconnected"
        @Volatile var connectedDeviceId: Int? = null

        val smsSentSession = AtomicInteger(0)

        fun resetState() {
            isRunning         = false
            statusMessage     = "Disconnected"
            connectedDeviceId = null
            smsSentSession.set(0)
        }
    }

    private val gson = Gson()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0,  TimeUnit.MILLISECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job?    = null
    private var smsWorkerJob: Job?    = null
    private var reconnectJob: Job?    = null
    private var statsJob: Job?        = null

    @Volatile private var isConnected     = false
    @Volatile private var shouldReconnect = true
    private var reconnectDelayMs          = 3_000L

    private lateinit var db: AppDatabase

    private val pendingResults: MutableList<Map<String, Any?>> =
        Collections.synchronizedList(mutableListOf())

    // ── SMS sent result receiver ──────────────────────────────────────────────

    private val smsSentReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            val smsId = intent.getIntExtra("smsId", -1)
            val msgId = intent.getLongExtra("msgId", -1L)
            if (msgId < 0L) return

            val success = resultCode == Activity.RESULT_OK
            val status  = if (success) "SUCCESS" else "FAILED"
            val error   = if (success) null else "Send error (resultCode=$resultCode)"

            lifecycleScope.launch(Dispatchers.IO) {
                db.pendingMessageDao().updateStatus(msgId, status, System.currentTimeMillis(), error)
                if (success) smsSentSession.incrementAndGet()
                log("SMS #$smsId → $status")
                updateNotification()

                if (smsId > 0) {
                    val payload = mapOf("type" to "SMS_RESULT", "smsId" to smsId,
                                        "status" to status, "error" to error)
                    pendingResults.add(payload)
                    flushResultBuffer()
                }
            }
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        db = AppDatabase.getInstance(this)
        createNotificationChannel()
        isRunning        = true
        shouldReconnect  = true
        reconnectDelayMs = 3_000L

        val filter = IntentFilter(SMS_SENT_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsSentReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(smsSentReceiver, filter)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        startForeground(NOTIFICATION_ID, buildNotification("Starting…"))
        lifecycleScope.launch {
            val recovered = withContext(Dispatchers.IO) {
                runCatching { db.pendingMessageDao().recoverStuck() }.getOrDefault(0)
            }
            if (recovered > 0) log("Recovered $recovered orphaned SENDING messages → PENDING")
            connect()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder? { super.onBind(intent); return null }

    override fun onDestroy() {
        super.onDestroy()
        isRunning         = false
        shouldReconnect   = false
        connectedDeviceId = null
        try { unregisterReceiver(smsSentReceiver) } catch (_: Exception) {}
        disconnect()
        client.dispatcher.executorService.shutdown()
    }

    // ── WebSocket connection ───────────────────────────────────────────────────

    private suspend fun connect() {
        val serverUrl = withContext(Dispatchers.IO) { db.configDao().get("server_url") }?.trimEnd('/')
        val token     = withContext(Dispatchers.IO) { db.configDao().get("auth_token") }
        val deviceId  = withContext(Dispatchers.IO) { db.configDao().get("device_id") }

        if (serverUrl == null || token == null || deviceId == null) {
            updateStatus("Not configured — open app to pair")
            return
        }

        val wsUrl = serverUrl
            .replace("https://", "wss://")
            .replace("http://",  "ws://")
            .plus("/api/ws")

        log("Connecting → $wsUrl")
        updateStatus("Connecting…")

        val request = Request.Builder()
            .url(wsUrl)
            .addHeader("User-Agent", "HYDROPY-Gateway/1.0 Android/${Build.VERSION.RELEASE}")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {

            override fun onOpen(ws: WebSocket, response: Response) {
                isConnected      = true
                reconnectDelayMs = 3_000L
                log("WS open — sending AUTH")
                ws.send(gson.toJson(mapOf(
                    "type"     to "AUTH",
                    "token"    to token,
                    "deviceId" to deviceId
                )))
            }

            override fun onMessage(ws: WebSocket, text: String) {
                lifecycleScope.launch { handleMessage(text) }
            }

            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                ws.close(1000, null)
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                handleDisconnect("closed $code")
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                handleDisconnect(t.message ?: t.javaClass.simpleName)
            }
        })
    }

    private fun handleDisconnect(reason: String) {
        if (isConnected) log("Disconnected: $reason")
        isConnected       = false
        connectedDeviceId = null
        heartbeatJob?.cancel()
        smsWorkerJob?.cancel()
        statsJob?.cancel()
        if (shouldReconnect) {
            updateStatus("Reconnecting in ${reconnectDelayMs / 1000}s…")
            scheduleReconnect()
        } else {
            updateStatus("Stopped")
        }
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        val delay = reconnectDelayMs
        reconnectDelayMs = (delay * 1.5).toLong().coerceAtMost(30_000L)
        reconnectJob = lifecycleScope.launch {
            delay(delay)
            if (shouldReconnect && !isConnected) connect()
        }
    }

    // ── Message handling ──────────────────────────────────────────────────────

    private suspend fun handleMessage(text: String) {
        try {
            @Suppress("UNCHECKED_CAST")
            val msg  = gson.fromJson(text, Map::class.java) as Map<String, Any?>
            val type = msg["type"] as? String ?: return

            when (type) {
                "AUTH_OK" -> {
                    val dbId = (msg["deviceId"] as? Double)?.toInt()
                    connectedDeviceId = dbId
                    updateStatus("Online — ready")
                    log("Authenticated ✓ device #$dbId")
                    startHeartbeat()
                    startSmsWorker()
                    startStatsReporter()
                    sendDeviceInfo()
                    flushResultBuffer()
                    replayUnreportedResults()
                }

                "AUTH_FAILED" -> {
                    log("Auth rejected — token stale, need to re-pair")
                    updateStatus("Auth failed — open app to re-pair")
                    shouldReconnect = false
                    stopSelf()
                }

                "HEARTBEAT_ACK" -> { /* acknowledged */ }

                "SEND_SMS" -> {
                    val number  = msg["number"]  as? String ?: return
                    val message = msg["message"] as? String ?: return
                    val smsId   = (msg["smsId"]  as? Double)?.toInt() ?: -1
                    log("Job #$smsId → $number (${message.length} chars)")
                    withContext(Dispatchers.IO) {
                        db.pendingMessageDao().insert(PendingMessage(
                            smsId       = smsId,
                            phoneNumber = number,
                            message     = message
                        ))
                    }
                    // Acknowledge receipt immediately
                    send(mapOf("type" to "SMS_STATUS", "smsId" to smsId, "status" to "ASSIGNED"))
                }

                "RESTART" -> {
                    log("Restart command from server")
                    disconnect(); delay(2_000); connect()
                }

                else -> log("Unknown: $type")
            }
        } catch (e: Exception) {
            log("Message error: ${e.message}")
        }
    }

    // ── Heartbeat ─────────────────────────────────────────────────────────────

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = lifecycleScope.launch {
            while (isConnected) {
                delay(25_000)
                val info = withContext(Dispatchers.IO) {
                    DeviceInfoHelper.getInfo(this@GatewayService)
                }
                send(mapOf(
                    "type"    to "HEARTBEAT",
                    "battery" to info.battery,
                    "signal"  to info.signal,
                    "storage" to info.storage
                ))
            }
        }
    }

    private fun sendDeviceInfo() {
        lifecycleScope.launch(Dispatchers.IO) {
            val info = DeviceInfoHelper.getInfo(this@GatewayService)
            val payload = mutableMapOf<String, Any?>(
                "type"           to "DEVICE_INFO",
                "phoneModel"     to info.model,
                "androidVersion" to info.androidVersion,
                "simInfo"        to info.simInfo,
                "battery"        to info.battery,
                "signal"         to info.signal
            )
            // Include phone number if available
            info.phoneNumber?.let { payload["phoneNumber"] = it }
            send(payload)
        }
    }

    // ── Bulk SMS worker ───────────────────────────────────────────────────────

    private fun startSmsWorker() {
        smsWorkerJob?.cancel()
        smsWorkerJob = lifecycleScope.launch {
            log("SMS worker started")
            while (isConnected) {
                val batch = withContext(Dispatchers.IO) {
                    runCatching { db.pendingMessageDao().getPending() }.getOrDefault(emptyList())
                }

                if (batch.isEmpty()) { delay(2_000); continue }

                log("Processing batch of ${batch.size} messages")
                for (msg in batch) {
                    withContext(Dispatchers.IO) {
                        db.pendingMessageDao().updateStatus(
                            msg.id, "SENDING", System.currentTimeMillis(), null
                        )
                    }
                    dispatchSms(msg)
                    delay(700) // 700 ms inter-message delay — respects carrier rate limits
                }
            }
            log("SMS worker stopped")
        }
    }

    // ── Stats notification ────────────────────────────────────────────────────

    private fun startStatsReporter() {
        statsJob?.cancel()
        statsJob = lifecycleScope.launch {
            while (isConnected) {
                delay(10_000)
                val pending = withContext(Dispatchers.IO) {
                    runCatching { db.pendingMessageDao().pendingCount() }.getOrDefault(0)
                }
                updateStatus("Online ✓  sent ${smsSentSession.get()} | queued $pending")
            }
        }
    }

    // ── SMS dispatch ──────────────────────────────────────────────────────────

    @Suppress("DEPRECATION")
    private fun dispatchSms(msg: PendingMessage) {
        try {
            val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                getSystemService(SmsManager::class.java)
            } else {
                SmsManager.getDefault()
            }

            val sentPi = makeSentIntent(msg.id, msg.smsId, msg.id)
            val parts  = smsManager.divideMessage(msg.message)

            if (parts.size == 1) {
                smsManager.sendTextMessage(msg.phoneNumber, null, msg.message, sentPi, null)
            } else {
                val intents = ArrayList<PendingIntent>(parts.size)
                repeat(parts.size - 1) { idx ->
                    intents.add(makeSentIntent(
                        requestCode = msg.id * 1000 + idx,
                        smsId       = -1,
                        msgId       = -1L
                    ))
                }
                intents.add(sentPi)
                smsManager.sendMultipartTextMessage(msg.phoneNumber, null, parts, intents, null)
            }

        } catch (e: Exception) {
            log("Dispatch failed #${msg.smsId}: ${e.message}")
            lifecycleScope.launch(Dispatchers.IO) {
                db.pendingMessageDao().updateStatus(
                    msg.id, "FAILED", System.currentTimeMillis(), e.message
                )
                val payload = mapOf("type" to "SMS_RESULT", "smsId" to msg.smsId,
                                    "status" to "FAILED", "error" to e.message)
                pendingResults.add(payload)
                flushResultBuffer()
            }
        }
    }

    private fun makeSentIntent(requestCode: Long, smsId: Int, msgId: Long): PendingIntent =
        PendingIntent.getBroadcast(
            this,
            (requestCode % Int.MAX_VALUE).toInt(),
            Intent(SMS_SENT_ACTION).apply {
                putExtra("smsId", smsId)
                putExtra("msgId", msgId)
                `package` = packageName
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    // ── Result buffer & replay ────────────────────────────────────────────────

    private fun flushResultBuffer() {
        if (!isConnected) return
        synchronized(pendingResults) {
            val iter = pendingResults.iterator()
            while (iter.hasNext()) {
                val payload = iter.next()
                val ws = webSocket
                if (ws != null && isConnected) { ws.send(gson.toJson(payload)); iter.remove() }
                else break
            }
        }
    }

    private fun replayUnreportedResults() {
        lifecycleScope.launch(Dispatchers.IO) {
            val since = System.currentTimeMillis() - 24 * 60 * 60 * 1000L
            runCatching {
                db.pendingMessageDao().getUnreported(since).forEach { m ->
                    pendingResults.add(mapOf(
                        "type"   to "SMS_RESULT",
                        "smsId"  to m.smsId,
                        "status" to m.status,
                        "error"  to m.errorMessage
                    ))
                }
            }
            if (pendingResults.isNotEmpty()) {
                log("Replaying ${pendingResults.size} unreported results")
                flushResultBuffer()
            }
        }
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    private fun send(payload: Map<String, Any?>) {
        val ws = webSocket
        if (ws != null && isConnected) ws.send(gson.toJson(payload))
    }

    private fun disconnect() {
        heartbeatJob?.cancel()
        smsWorkerJob?.cancel()
        reconnectJob?.cancel()
        statsJob?.cancel()
        webSocket?.close(1000, "stopping")
        webSocket   = null
        isConnected = false
    }

    private fun updateStatus(status: String) {
        statusMessage = status
        updateNotification()
    }

    private fun updateNotification() {
        try {
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .notify(NOTIFICATION_ID, buildNotification(statusMessage))
        } catch (_: Exception) {}
    }

    private fun log(message: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            try { db.localLogDao().insert(LocalLog(level = "info", message = message)) } catch (_: Exception) {}
            try { db.localLogDao().cleanOld(System.currentTimeMillis() - 3 * 24 * 60 * 60 * 1000L) } catch (_: Exception) {}
        }
    }

    private fun buildNotification(status: String): Notification {
        val pi = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("HYDROPY Gateway")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "HYDROPY SMS Gateway", NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Keeps the SMS gateway running in the background"
            setShowBadge(false)
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }
}
