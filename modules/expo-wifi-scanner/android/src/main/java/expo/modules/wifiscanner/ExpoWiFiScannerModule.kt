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

    AsyncFunction("isLocationEnabledAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val lm = context.getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
      lm?.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER) == true ||
        lm?.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER) == true
    }
  }

  private fun scanNetworks(): List<Map<String, Any?>> {
    val context = appContext.reactContext ?: return emptyList()
    if (!hasScanPermission(context)) {
      return emptyList()
    }

    val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
      ?: return emptyList()

    // Try to trigger a fresh scan
    try {
      wifiManager.startScan()
    } catch (_: Throwable) {}

    // Wait for scan results (up to 5 seconds)
    val scanResults = waitForScanResults(context, wifiManager)

    return scanResults
        .filterNotNull()
        .map { it.toNetworkMap() }
  }

  private fun waitForScanResults(context: Context, wifiManager: WifiManager): List<ScanResult> {
    // Check for existing results first
    val initial = try { wifiManager.scanResults } catch (_: Throwable) { null }
    if (initial != null && initial.isNotEmpty()) {
      return initial.filterNotNull()
    }

    val latch = java.util.concurrent.CountDownLatch(1)
    var receivedResults: List<ScanResult>? = null

    val receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == WifiManager.SCAN_RESULTS_AVAILABLE_ACTION) {
          receivedResults = try { wifiManager.scanResults } catch (_: Throwable) { null }
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
      
      // Trigger scan after registering receiver
      wifiManager.startScan()
      
      latch.await(5, TimeUnit.SECONDS)
      context.unregisterReceiver(receiver)
    } catch (_: Throwable) {
      latch.countDown()
    }

    return receivedResults?.filterNotNull()
      ?: try { wifiManager.scanResults?.filterNotNull() } catch (_: Throwable) { emptyList() }
      ?: emptyList()
  }

  private fun getCurrentNetwork(): Map<String, Any?> {
    val context = appContext.reactContext ?: return emptyCurrent()
    if (!hasScanPermission(context)) {
      return emptyCurrent()
    }

    val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
    
    // Try ConnectivityManager for modern Android (API 23+)
    val cmResult = getCurrentNetworkFromConnectivityManager(context)
    if (cmResult != null) return cmResult

    // Fallback to connectionInfo
    val info = wifiManager?.connectionInfo
    if (info != null) {
      val ssid = info.ssid?.cleanSsid()?.takeUnless { it.isBlank() || it == "<unknown ssid>" }
      val bssid = info.bssid?.lowercase()?.takeUnless { it == "02:00:00:00:00:00" || it.isBlank() }
      if (ssid != null || bssid != null) {
        return mapOf(
          "ssid" to ssid,
          "bssid" to bssid,
          "rssi" to info.rssi,
          "frequency" to info.frequency
        )
      }
    }

    return emptyCurrent()
  }

  private fun getCurrentNetworkFromConnectivityManager(context: Context): Map<String, Any?>? {
    val cm = context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
      ?: return null

    val network = cm.activeNetwork ?: return null
    val caps = cm.getNetworkCapabilities(network) ?: return null

    if (!caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
      return null
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val wifiInfo = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          caps.transportInfo as? android.net.wifi.WifiInfo
        } else {
          // On API 29, transportInfo might not be WifiInfo directly or needs different handling
          null
        }
      } catch (_: Throwable) { null }

      if (wifiInfo != null) {
        val ssid = wifiInfo.ssid?.cleanSsid()?.takeUnless { it.isBlank() || it == "<unknown ssid>" }
        val bssid = wifiInfo.bssid?.lowercase()?.takeUnless { it == "02:00:00:00:00:00" || it.isBlank() }
        if (ssid != null || bssid != null) {
          return mapOf(
            "ssid" to ssid,
            "bssid" to bssid,
            "rssi" to wifiInfo.rssi,
            "frequency" to wifiInfo.frequency
          )
        }
      }
    }

    // If we are here, we are connected to WiFi but couldn't get SSID
    return mapOf("ssid" to "Connected (SSID hidden)", "bssid" to null)
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
