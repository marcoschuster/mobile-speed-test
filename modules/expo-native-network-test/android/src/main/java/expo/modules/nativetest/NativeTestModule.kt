package expo.modules.nativetest

import android.Manifest
import android.content.Context
import android.net.wifi.ScanResult
import android.net.wifi.WifiManager
import android.os.Build
import android.telephony.*
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

class NativeTestModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeTestModule")

    AsyncFunction("runUdpJitterTest") { host: String, port: Int, count: Int ->
      runUdpJitterTest(host, port, count)
    }

    AsyncFunction("getWifiNetworks") {
      getWifiNetworks()
    }

    AsyncFunction("get5GInfo") {
      get5GInfo()
    }
  }

  private fun runUdpJitterTest(host: String, port: Int, count: Int): Map<String, Any?> {
    val socket = DatagramSocket()
    socket.soTimeout = 1000
    val address = try { InetAddress.getByName(host) } catch (e: Exception) { return mapOf("error" to "Invalid host") }
    
    val rtts = mutableListOf<Double>()
    var lost = 0
    
    val payload = "ping".toByteArray()
    
    for (i in 0 until count) {
      val packet = DatagramPacket(payload, payload.size, address, port)
      val startTime = System.nanoTime()
      
      try {
        socket.send(packet)
        val buffer = ByteArray(256)
        val response = DatagramPacket(buffer, buffer.size)
        socket.receive(response)
        val endTime = System.nanoTime()
        val rtt = (endTime - startTime) / 1_000_000.0
        rtts.add(rtt)
      } catch (e: Exception) {
        lost++
      }
      
      // Delay between packets
      if (i < count - 1) {
          Thread.sleep(20)
      }
    }
    
    socket.close()
    
    val avgRtt = if (rtts.isNotEmpty()) rtts.average() else 0.0
    val jitter = if (rtts.size >= 2) {
      var sum = 0.0
      for (i in 0 until rtts.size - 1) {
        sum += Math.abs(rtts[i+1] - rtts[i])
      }
      sum / (rtts.size - 1)
    } else 0.0
    
    return mapOf(
      "avgRtt" to avgRtt,
      "jitter" to jitter,
      "packetLoss" to (lost.toDouble() / count * 100.0),
      "samples" to rtts.size
    )
  }

  private fun getWifiNetworks(): List<Map<String, Any?>> {
    val context = appContext.reactContext ?: return emptyList()
    val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
      ?: return emptyList()
      
    val results = try { wifiManager.scanResults } catch (e: SecurityException) { emptyList<ScanResult>() }
    return results.map {
      mapOf(
        "ssid" to it.SSID,
        "bssid" to it.BSSID,
        "rssi" to it.level,
        "frequency" to it.frequency,
        "channel" to frequencyToChannel(it.frequency)
      )
    }
  }

  private fun get5GInfo(): Map<String, Any?> {
    val context = appContext.reactContext ?: return emptyMap()
    val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
      ?: return emptyMap()
      
    val allInfo = try { tm.allCellInfo } catch (e: SecurityException) { null } ?: return emptyMap()
    val nrCell = allInfo.filterIsInstance<CellInfoNr>().firstOrNull { it.isRegistered }
      ?: allInfo.filterIsInstance<CellInfoNr>().firstOrNull()
      
    if (nrCell != null) {
      val identity = nrCell.cellIdentity as? CellIdentityNr
      val signal = nrCell.cellSignalStrength as? CellSignalStrengthNr
      return mapOf(
        "type" to "5G",
        "rsrp" to signal?.ssRsrp,
        "rsrq" to signal?.ssRsrq,
        "sinr" to signal?.ssSinr,
        "nci" to identity?.nci?.toString(),
        "pci" to identity?.pci,
        "tac" to identity?.tac
      )
    }
    
    return mapOf("type" to "Unknown/No 5G")
  }

  private fun frequencyToChannel(frequency: Int): Int {
    return when {
      frequency == 2484 -> 14
      frequency in 2412..2472 -> (frequency - 2407) / 5
      frequency in 5170..5900 -> (frequency - 5000) / 5
      frequency in 5945..7125 -> (frequency - 5940) / 5
      else -> 0
    }
  }
}
