package expo.modules.wifiscanner

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.ScanResult
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

class ExpoWiFiScannerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoWiFiScanner")

    AsyncFunction("scanAsync") {
      scanNetworks()
    }

    AsyncFunction("getCurrentNetworkAsync") {
      getCurrentNetwork()
    }
  }

  private fun scanNetworks(): List<Map<String, Any?>> {
    val context = appContext.reactContext ?: return emptyList()
    if (!hasScanPermission(context)) {
      println("WiFiScanner: No scan permission")
      return emptyList()
    }

    val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
      ?: return emptyList()

    // Try to trigger a fresh scan, but don't fail if throttled
    try {
      wifiManager.startScan()
      println("WiFiScanner: Scan triggered successfully")
    } catch (_: SecurityException) {
      println("WiFiScanner: Security exception during scan")
      return emptyList()
    } catch (_: Throwable) {
      println("WiFiScanner: Other exception during scan: ${_}")
      // Android may throttle or reject active scans. Stale scanResults are still useful.
    }

    // Wait for scan results to be available (up to 5 seconds)
    val scanResults = waitForScanResults(context, wifiManager)
    println("WiFiScanner: Got ${scanResults.size} scan results")

    return try {
      val mapped = scanResults
        .filterNotNull()
        .map { result -> result.toNetworkMap() }
      println("WiFiScanner: Mapped to ${mapped.size} network maps")
      mapped
    } catch (_: SecurityException) {
      println("WiFiScanner: Security exception during mapping")
      emptyList()
    } catch (_: Throwable) {
      println("WiFiScanner: Other exception during mapping: ${_}")
      emptyList()
    }
  }

  private fun waitForScanResults(context: Context, wifiManager: WifiManager): List<ScanResult> {
    // First check if there are already fresh results available
    val initial = try { wifiManager.scanResults } catch (_: SecurityException) { null } catch (_: Throwable) { null }
    if (initial != null && initial.isNotEmpty()) {
      return initial.filterNotNull()
    }

    // Register a receiver and wait for the scan to complete
    val latch = java.util.concurrent.CountDownLatch(1)
    var receivedResults: List<ScanResult>? = null

    val receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == WifiManager.SCAN_RESULTS_AVAILABLE_ACTION) {
          val success = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false)
          if (success) {
            receivedResults = try { wifiManager.scanResults } catch (_: Throwable) { null }
          }
          latch.countDown()
        }
      }
    }

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(receiver, IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION), Context.RECEIVER_NOT_EXPORTED)
      } else {
        context.registerReceiver(receiver, IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION))
      }
    } catch (_: Throwable) {
      // Can't register receiver, return whatever we have
      return initial?.filterNotNull() ?: emptyList()
    }

    // Trigger another scan now that we're listening
    try {
      wifiManager.startScan()
    } catch (_: Throwable) { /* already tried above */ }

    try {
      latch.await(5, TimeUnit.SECONDS)
    } catch (_: InterruptedException) { /* timeout */ }

    try {
      context.unregisterReceiver(receiver)
    } catch (_: Throwable) { /* already unregistered */ }

    return receivedResults?.filterNotNull()
      ?: try { wifiManager.scanResults?.filterNotNull() } catch (_: Throwable) { emptyList() }
      ?: emptyList()
  }

  private fun getCurrentNetwork(): Map<String, Any?> {
    val context = appContext.reactContext ?: return emptyCurrent()
    if (!hasScanPermission(context)) {
      return emptyCurrent()
    }

    // On Android 10+ (API 29+), WifiManager.getConnectionInfo() returns "<unknown ssid>"
    // unless the app has location permission AND location services are enabled.
    // Use ConnectivityManager as a fallback to detect WiFi connectivity.
    val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager

    // Try the modern ConnectivityManager approach first (API 23+)
    val cmResult = getCurrentNetworkFromConnectivityManager(context)
    if (cmResult != null) return cmResult

    // Fallback to WifiManager for older devices
    if (wifiManager != null) {
      return try {
        val info = wifiManager.connectionInfo ?: return emptyCurrent()
        val ssid = info.ssid?.cleanSsid()?.takeUnless { it.isBlank() || it == "<unknown ssid>" }
        val bssid = info.bssid?.lowercase()?.takeUnless { it == "02:00:00:00:00:00" || it.isBlank() }
        if (ssid != null || bssid != null) {
          mapOf("ssid" to ssid, "bssid" to bssid)
        } else {
          emptyCurrent()
        }
      } catch (_: SecurityException) {
        emptyCurrent()
      } catch (_: Throwable) {
        emptyCurrent()
      }
    }

    return emptyCurrent()
  }

  private fun getCurrentNetworkFromConnectivityManager(context: Context): Map<String, Any?>? {
    val cm = context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
      ?: return null

    val network = cm.activeNetwork ?: return null
    val caps = cm.getNetworkCapabilities(network) ?: return null

    // Check if the active network is WiFi
    if (!caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
      return null
    }

    // On API 29+, we can get WifiInfo from the network
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      // Try to get link properties / wifi info through the network
      val wifiInfo = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          // On API 30+, use the transport info
          val transportInfo = caps.transportInfo as? android.net.wifi.WifiInfo
          transportInfo
        } else {
          null
        }
      } catch (_: Throwable) { null }

      if (wifiInfo != null) {
        val ssid = wifiInfo.ssid?.cleanSsid()?.takeUnless { it.isBlank() || it == "<unknown ssid>" }
        val bssid = wifiInfo.bssid?.lowercase()?.takeUnless { it == "02:00:00:00:00:00" || it.isBlank() }
        if (ssid != null || bssid != null) {
          return mapOf("ssid" to ssid, "bssid" to bssid)
        }
      }

      // Even if we can't get the SSID, we know WiFi is connected
      // Return a marker so the JS side knows WiFi is active
      return mapOf("ssid" to "Connected (SSID hidden)", "bssid" to null)
    }

    return null
  }

  private fun hasScanPermission(context: Context): Boolean {
    val hasLocation = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED

    val hasNearbyWifi = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.NEARBY_WIFI_DEVICES,
      ) == PackageManager.PERMISSION_GRANTED

    // On Android 13+: NEARBY_WIFI_DEVICES alone is sufficient
    // On older: ACCESS_FINE_LOCATION is required
    return hasNearbyWifi || hasLocation
  }

  private fun ScanResult.toNetworkMap(): Map<String, Any?> {
    return mapOf(
      "ssid" to SSID.cleanSsid().ifBlank { "Hidden network" },
      "bssid" to (BSSID ?: "").lowercase(),
      "frequency" to frequency,
      "channel" to frequencyToChannel(frequency),
      "rssi" to level,
      "capabilities" to (capabilities ?: ""),
    )
  }

  private fun String.cleanSsid(): String {
    return trim().removePrefix("\"").removeSuffix("\"")
  }

  private fun emptyCurrent(): Map<String, Any?> {
    return mapOf(
      "ssid" to null,
      "bssid" to null,
    )
  }

  private fun frequencyToChannel(frequency: Int): Int {
    return when {
      frequency == 2484 -> 14
      frequency in 2412..2472 -> (frequency - 2407) / 5
      frequency in 4910..5895 -> (frequency - 5000) / 5
      frequency in 5955..7115 -> (frequency - 5950) / 5
      else -> 0
    }
  }
}
