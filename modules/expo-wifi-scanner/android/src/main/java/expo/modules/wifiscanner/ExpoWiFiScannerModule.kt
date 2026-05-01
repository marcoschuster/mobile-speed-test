package expo.modules.wifiscanner

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.ScanResult
import android.net.wifi.WifiManager
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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
      return emptyList()
    }

    val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
      ?: return emptyList()

    try {
      wifiManager.startScan()
    } catch (_: SecurityException) {
      return emptyList()
    } catch (_: Throwable) {
      // Android may throttle or reject active scans. Stale scanResults are still useful.
    }

    return try {
      wifiManager.scanResults
        ?.filterNotNull()
        ?.map { result -> result.toNetworkMap() }
        ?: emptyList()
    } catch (_: SecurityException) {
      emptyList()
    } catch (_: Throwable) {
      emptyList()
    }
  }

  private fun getCurrentNetwork(): Map<String, Any?> {
    val context = appContext.reactContext ?: return emptyCurrent()
    if (!hasScanPermission(context)) {
      return emptyCurrent()
    }

    val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
      ?: return emptyCurrent()

    return try {
      val info = wifiManager.connectionInfo ?: return emptyCurrent()
      mapOf(
        "ssid" to info.ssid?.cleanSsid()?.takeUnless { it.isBlank() || it == "<unknown ssid>" },
        "bssid" to info.bssid?.lowercase()?.takeUnless { it == "02:00:00:00:00:00" || it.isBlank() },
      )
    } catch (_: SecurityException) {
      emptyCurrent()
    } catch (_: Throwable) {
      emptyCurrent()
    }
  }

  private fun hasScanPermission(context: Context): Boolean {
    val hasLocation = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED

    val hasNearbyWifi = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.NEARBY_WIFI_DEVICES,
      ) == PackageManager.PERMISSION_GRANTED

    return hasLocation || hasNearbyWifi
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
