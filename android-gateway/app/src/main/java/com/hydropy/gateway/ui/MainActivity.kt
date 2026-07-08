package com.hydropy.gateway.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.hydropy.gateway.R
import com.hydropy.gateway.data.AppDatabase
import com.hydropy.gateway.data.Config
import com.hydropy.gateway.service.GatewayService
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var db: AppDatabase
    private lateinit var tvStatus: TextView
    private lateinit var tvDeviceId: TextView
    private lateinit var etServer: EditText
    private lateinit var etPairCode: EditText
    private lateinit var btnConnect: Button
    private lateinit var btnDisconnect: Button

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val allGranted = perms.values.all { it }
        if (allGranted) startGatewayService()
        else showToast("Some permissions denied - SMS gateway may not work fully")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        db = AppDatabase.getInstance(this)

        tvStatus = findViewById(R.id.tvStatus)
        tvDeviceId = findViewById(R.id.tvDeviceId)
        etServer = findViewById(R.id.etServer)
        etPairCode = findViewById(R.id.etPairCode)
        btnConnect = findViewById(R.id.btnConnect)
        btnDisconnect = findViewById(R.id.btnDisconnect)

        btnConnect.setOnClickListener { onConnectClicked() }
        btnDisconnect.setOnClickListener { onDisconnectClicked() }

        lifecycleScope.launch { loadSavedConfig() }
        startStatusPolling()
    }

    private fun onConnectClicked() {
        val serverUrl = etServer.text.toString().trim()
        val pairCode = etPairCode.text.toString().trim().uppercase()

        if (serverUrl.isEmpty()) { showToast("Enter server URL"); return }
        if (pairCode.isEmpty()) { showToast("Enter pair code"); return }

        tvStatus.text = "Pairing..."
        btnConnect.isEnabled = false

        lifecycleScope.launch {
            try {
                val result = pairWithServer(serverUrl, pairCode)
                if (result != null) {
                    db.configDao().set(Config("server_url", serverUrl))
                    db.configDao().set(Config("auth_token", result.token))
                    db.configDao().set(Config("device_id", result.deviceId.toString()))
                    requestPermissionsAndStart()
                } else {
                    tvStatus.text = "Pairing failed - check code"
                    btnConnect.isEnabled = true
                }
            } catch (e: Exception) {
                tvStatus.text = "Error: ${e.message}"
                btnConnect.isEnabled = true
            }
        }
    }

    private fun onDisconnectClicked() {
        stopService(Intent(this, GatewayService::class.java))
        tvStatus.text = "Disconnected"
        GatewayService.statusMessage = "Disconnected"
    }

    private suspend fun pairWithServer(serverUrl: String, pairCode: String): PairResult? {
        return try {
            val url = serverUrl.trimEnd('/') + "/api/devices/pair"
            val client = okhttp3.OkHttpClient()
            val body = okhttp3.RequestBody.create(
                okhttp3.MediaType.parse("application/json"),
                """{"pairCode":"$pairCode","deviceId":"${android.provider.Settings.Secure.getString(contentResolver, android.provider.Settings.Secure.ANDROID_ID)}","phoneModel":"${Build.MODEL}","androidVersion":"Android ${Build.VERSION.RELEASE}"}"""
            )
            val request = okhttp3.Request.Builder().url(url).post(body).build()
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return null
            val json = com.google.gson.Gson().fromJson(response.body()!!.string(), Map::class.java)
            val success = json["success"] as? Boolean ?: false
            if (!success) return null
            PairResult(
                token = json["token"] as? String ?: return null,
                deviceId = (json["deviceId"] as? Double)?.toInt() ?: return null
            )
        } catch (e: Exception) { null }
    }

    private fun requestPermissionsAndStart() {
        val permissions = mutableListOf(
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_PHONE_STATE,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val notGranted = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (notGranted.isEmpty()) startGatewayService()
        else permissionsLauncher.launch(notGranted.toTypedArray())
    }

    private fun startGatewayService() {
        val intent = Intent(this, GatewayService::class.java)
        ContextCompat.startForegroundService(this, intent)
        tvStatus.text = "Connecting..."
    }

    private suspend fun loadSavedConfig() {
        val serverUrl = db.configDao().get("server_url")
        val token = db.configDao().get("auth_token")
        if (serverUrl != null) {
            etServer.setText(serverUrl)
        }
        if (token != null) {
            tvStatus.text = if (GatewayService.isRunning) "Service running" else "Tap Connect to start"
        }
    }

    private fun startStatusPolling() {
        lifecycleScope.launch {
            while (true) {
                tvStatus.text = GatewayService.statusMessage
                btnConnect.isEnabled = !GatewayService.isRunning
                btnDisconnect.isEnabled = GatewayService.isRunning
                GatewayService.connectedDeviceId?.let {
                    tvDeviceId.text = "Device ID: $it"
                }
                delay(2000)
            }
        }
    }

    private fun showToast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    data class PairResult(val token: String, val deviceId: Int)
}
