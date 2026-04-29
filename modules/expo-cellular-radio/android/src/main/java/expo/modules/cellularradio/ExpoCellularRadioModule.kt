package expo.modules.cellularradio

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.CellIdentityLte
import android.telephony.CellIdentityNr
import android.telephony.CellInfo
import android.telephony.CellInfoLte
import android.telephony.CellInfoNr
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoCellularRadioModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoCellularRadio")

    AsyncFunction("getCellInfoAsync") {
      getCellInfo()
    }
  }

  private fun getCellInfo(): Map<String, Any?> {
    val context = appContext.reactContext ?: return emptyResult()
    val packageManager = context.packageManager

    if (!packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY_RADIO_ACCESS)) {
      return emptyResult()
    }

    val hasPhoneState = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.READ_PHONE_STATE,
    ) == PackageManager.PERMISSION_GRANTED
    val hasFineLocation = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED

    if (!hasPhoneState || !hasFineLocation) {
      return emptyResult()
    }

    val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
      ?: return emptyResult()

    return try {
      val allCellInfo = telephonyManager.allCellInfo ?: emptyList()
      val servingCell = allCellInfo.firstOrNull { it.isRegistered } ?: allCellInfo.firstOrNull()

      when (servingCell) {
        is CellInfoNr -> extractNr(servingCell)
        is CellInfoLte -> extractLte(servingCell)
        else -> emptyResult()
      }
    } catch (_: SecurityException) {
      emptyResult()
    } catch (_: Throwable) {
      emptyResult()
    }
  }

  private fun extractNr(cellInfo: CellInfoNr): Map<String, Any?> {
    val identity = cellInfo.cellIdentity as? CellIdentityNr
    val signal = cellInfo.cellSignalStrength as? CellSignalStrengthNr

    val bandValue = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      identity?.bands?.firstOrNull()?.let { "n$it" }
    } else {
      null
    }

    return mapOf(
      "rsrp" to signal?.ssRsrp?.takeIfAvailable(),
      "rsrq" to signal?.ssRsrq?.takeIfAvailable(),
      "band" to bandValue,
      "earfcn" to identity?.nrarfcn?.takeIfAvailable(),
      "cellId" to identity?.nci?.takeIfAvailableLong()?.toString(),
    )
  }

  private fun extractLte(cellInfo: CellInfoLte): Map<String, Any?> {
    val identity = cellInfo.cellIdentity as? CellIdentityLte
    val signal = cellInfo.cellSignalStrength as? CellSignalStrengthLte

    val bandValue = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      identity?.bands?.firstOrNull()?.let { "B$it" }
    } else {
      null
    }

    return mapOf(
      "rsrp" to signal?.rsrp?.takeIfAvailable(),
      "rsrq" to signal?.rsrq?.takeIfAvailable(),
      "band" to bandValue,
      "earfcn" to identity?.earfcn?.takeIfAvailable(),
      "cellId" to identity?.ci?.takeIfAvailable()?.toString(),
    )
  }

  private fun Int.takeIfAvailable(): Int? {
    return if (this == CellInfo.UNAVAILABLE || this == Int.MAX_VALUE || this == Int.MIN_VALUE) null else this
  }

  private fun Long.takeIfAvailableLong(): Long? {
    return if (this == CellInfo.UNAVAILABLE_LONG || this == Long.MAX_VALUE || this == Long.MIN_VALUE) null else this
  }

  private fun emptyResult(): Map<String, Any?> {
    return mapOf(
      "rsrp" to null,
      "rsrq" to null,
      "band" to null,
      "earfcn" to null,
      "cellId" to null,
    )
  }
}
