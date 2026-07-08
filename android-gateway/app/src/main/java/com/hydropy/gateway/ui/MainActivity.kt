package com.hydropy.gateway.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.hydropy.gateway.R
import com.hydropy.gateway.data.AppDatabase
import com.hydropy.gateway.data.Config
import com.hydropy.gateway.service.GatewayService
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    // ── Views ───────────────────────────────────────────────────────────────
    private lateinit var cardPermissions: LinearLayout
    private lateinit var tvPermissionDetail: TextView
    private lateinit var btnGrantPermissions: Button
    private lateinit var tvStatus: TextView
    private lateinit var tvDeviceId: TextView
    private lateinit var tvSmsSent: TextView
    private lateinit var sectionSetup: LinearLayout
    private lateinit var sectionConnected: LinearLayout
    private lateinit var etServer: EditText
    private lateinit var etPairCode: EditText
    private lateinit var btnConnect: Button
    private lateinit var tvSentCount: TextView
    private lateinit var tvPendingCount: TextView
    private lateinit var tvServerUrl: TextView
    private lateinit var tvLog: TextView
    private lateinit var btnDisconnect: Button

    private lateinit var db: AppDatabase

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    // All permissions the app needs
    private val requiredPermissions: List<String> get() {
        val perms = mutableListOf(
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_PHONE_NUMBERS,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        return perms
    }

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        refreshPermissionUI()
        val denied = results.filterValues { !it }.keys
        if (denied.isNotEmpty()) {
            toast("⚠ Some permissions denied — SMS may not work: ${denied.joinToString()}")
        }
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        db = AppDatabase.getInstance(this)

        cardPermissions   = findViewById(R.id.cardPermissions)
        tvPermissionDetail= findViewById(R.id.tvPermissionDetail)
        btnGrantPermissions=findViewById(R.id.btnGrantPermissions)
        tvStatus          = findViewById(R.id.tvStatus)
        tvDeviceId        = findViewById(R.id.tvDeviceId)
        tvSmsSent         = findViewById(R.id.tvSmsSent)
        sectionSetup      = findViewById(R.id.sectionSetup)
        sectionConnected  = findViewById(R.id.sectionConnected)
        etServer          = findViewById(R.id.etServer)
        etPairCode        = findViewById(R.id.etPairCode)
        btnConnect        = findViewById(R.id.btnConnect)
        tvSentCount       = findViewById(R.id.tvSentCount)
        tvPendingCount    = findViewById(R.id.tvPendingCount)
        tvServerUrl       = findViewById(R.id.tvServerUrl)
        tvLog             = findViewById(R.id.tvLog)
        btnDisconnect     = findViewById(R.id.btnDisconnect)

        btnGrantPermissions.setOnClickListener { requestAllPermissions() }
        btnConnect.setOnClickListener { onConnectClicked() }
        btnDisconnect.setOnClickListener { onDisconnectClicked() }

        // Ask permissions immediately on first launch
        requestAllPermissions()

        lifecycleScope.launch { initialise() }
        startPolling()
    }

    override fun onResume() {
        super.onResume()
        refreshPermissionUI()
    }

    // ── Initialisation ──────────────────────────────────────────────────────

    private suspend fun initialise() {
        val serverUrl = withContext(Dispatchers.IO) { db.configDao().get("server_url") }
        val token     = withContext(Dispatchers.IO) { db.configDao().get("auth_token") }

        if (serverUrl != null) {
            etServer.setText(serverUrl)
        }

        if (token != null) {
            // Already paired — auto-start service if not running
            showConnectedSection(serverUrl ?: "")
            if (!GatewayService.isRunning) {
                startService()
            }
        }
    }

    // ── Permissions ─────────────────────────────────────────────────────────

    private fun missingPermissions(): List<String> = requiredPermissions.filter {
        ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }

    private fun requestAllPermissions() {
        val missing = missingPermissions()
        if (missing.isNotEmpty()) permissionsLauncher.launch(missing.toTypedArray())
        else refreshPermissionUI()
    }

    private fun refreshPermissionUI() {
        val missing = missingPermissions()
        if (missing.isEmpty()) {
            cardPermissions.visibility = View.GONE
        } else {
            cardPermissions.visibility = View.VISIBLE
            tvPermissionDetail.text = "Missing: ${missing.joinToString { it.substringAfterLast('.') }}"
        }
    }

    // ── Connect flow ────────────────────────────────────────────────────────

    private fun onConnectClicked() {
        val serverUrl = etServer.text.toString().trim().trimEnd('/')
        val pairCode  = etPairCode.text.toString().trim().uppercase()

        if (serverUrl.isEmpty()) { toast("Enter the server URL"); return }
        if (!serverUrl.startsWith("https://") && !serverUrl.startsWith("http://")) {
            toast("URL must start with https://"); return
        }
        if (pairCode.length < 4) { toast("Enter the pair code"); return }

        btnConnect.isEnabled = false
        setStatus("Pairing with server…")

        lifecycleScope.launch {
            val result = pairWithServer(serverUrl, pairCode)
            if (result != null) {
                withContext(Dispatchers.IO) {
                    db.configDao().set(Config("server_url", serverUrl))
                    db.configDao().set(Config("auth_token", result.token))
                    db.configDao().set(Config("device_id", result.deviceId.toString()))
                }
                etPairCode.setText("")
                showConnectedSection(serverUrl)
                setStatus("Paired — connecting…")
                startService()
            } else {
                btnConnect.isEnabled = true
            }
        }
    }

    private fun onDisconnectClicked() {
        stopService(Intent(this, GatewayService::class.java))
        GatewayService.resetState()
        lifecycleScope.launch(Dispatchers.IO) {
            db.configDao().delete("server_url")
            db.configDao().delete("auth_token")
            db.configDao().delete("device_id")
        }
        showSetupSection()
        setStatus("Disconnected — configure a new server to begin")
    }

    // ── HTTP pairing ────────────────────────────────────────────────────────

    private suspend fun pairWithServer(serverUrl: String, pairCode: String): PairResult? =
        withContext(Dispatchers.IO) {
            try {
                val androidId = android.provider.Settings.Secure.getString(
                    contentResolver, android.provider.Settings.Secure.ANDROID_ID
                )
                val payload = Gson().toJson(mapOf(
                    "pairCode"       to pairCode,
                    "deviceId"       to androidId,
                    "phoneModel"     to Build.MODEL,
                    "androidVersion" to "Android ${Build.VERSION.RELEASE}"
                ))
                val request = Request.Builder()
                    .url("$serverUrl/api/devices/pair")
                    .post(payload.toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()

                val response = httpClient.newCall(request).execute()
                val body = response.body?.string()

                if (!response.isSuccessful || body.isNullOrBlank()) {
                    val errMsg = if (body != null) runCatching {
                        @Suppress("UNCHECKED_CAST")
                        (Gson().fromJson(body, Map::class.java) as Map<String, Any?>)["error"] as? String
                    }.getOrNull() else null
                    withContext(Dispatchers.Main) {
                        setStatus("Pairing failed: ${errMsg ?: "HTTP ${response.code}"}")
                    }
                    return@withContext null
                }

                @Suppress("UNCHECKED_CAST")
                val json = Gson().fromJson(body, Map::class.java) as Map<String, Any?>
                val success = json["success"] as? Boolean ?: false
                if (!success) {
                    withContext(Dispatchers.Main) { setStatus("Server rejected the pair code") }
                    return@withContext null
                }
                PairResult(
                    token    = json["token"]    as? String ?: return@withContext null,
                    deviceId = (json["deviceId"] as? Double)?.toInt() ?: return@withContext null
                )
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { setStatus("Network error: ${e.message}") }
                null
            }
        }

    // ── Service control ─────────────────────────────────────────────────────

    private fun startService() {
        ContextCompat.startForegroundService(this, Intent(this, GatewayService::class.java))
    }

    // ── UI helpers ──────────────────────────────────────────────────────────

    private fun showSetupSection() {
        sectionSetup.visibility = View.VISIBLE
        sectionConnected.visibility = View.GONE
    }

    private fun showConnectedSection(serverUrl: String) {
        sectionSetup.visibility = View.GONE
        sectionConnected.visibility = View.VISIBLE
        tvServerUrl.text = serverUrl
    }

    private fun setStatus(s: String) {
        tvStatus.text = s
    }

    // ── Polling loop (1.5 s) ────────────────────────────────────────────────

    private fun startPolling() {
        lifecycleScope.launch {
            while (true) {
                delay(1_500)
                // Sync status from service
                tvStatus.text = GatewayService.statusMessage

                val did = GatewayService.connectedDeviceId
                tvDeviceId.text = if (did != null) "ID #$did" else ""

                // Stats (only when connected section visible)
                if (sectionConnected.visibility == View.VISIBLE) {
                    val sent    = GatewayService.smsSentSession
                    val pending = withContext(Dispatchers.IO) {
                        runCatching { db.pendingMessageDao().pendingCount() }.getOrDefault(0)
                    }
                    tvSentCount.text    = sent.toString()
                    tvPendingCount.text = pending.toString()

                    // Recent logs
                    val logs = withContext(Dispatchers.IO) {
                        runCatching { db.localLogDao().getRecent() }.getOrDefault(emptyList())
                    }
                    tvLog.text = logs.take(5).joinToString("\n") { it.message }
                        .ifBlank { "—" }
                }

                // If service stopped and section is connected, reflect that
                if (!GatewayService.isRunning && sectionConnected.visibility == View.VISIBLE) {
                    // Reconnect attempt is handled by the service itself (START_STICKY)
                }
            }
        }
    }

    private fun toast(msg: String) =
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    data class PairResult(val token: String, val deviceId: Int)
}
