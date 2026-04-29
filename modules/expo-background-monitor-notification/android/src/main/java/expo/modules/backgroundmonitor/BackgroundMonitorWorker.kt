package expo.modules.backgroundmonitor

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import kotlin.math.max

class BackgroundMonitorWorker(
  context: Context,
  params: WorkerParameters,
) : Worker(context, params) {
  override fun doWork(): Result {
    if (isDisabled()) {
      return Result.success()
    }

    return try {
      val ping = runPing()
      val download = runDownload()
      val upload = runUpload()
      saveResult(ping, download, upload)
      ExpoBackgroundMonitorNotificationModule.updateNextRunEstimate(applicationContext)
      Result.success()
    } catch (_: Throwable) {
      Result.retry()
    }
  }

  private fun isDisabled(): Boolean {
    return applicationContext
      .getSharedPreferences(ExpoBackgroundMonitorNotificationModule.PREFERENCES_NAME, Context.MODE_PRIVATE)
      .getBoolean(ExpoBackgroundMonitorNotificationModule.DISABLED_KEY, false)
  }

  private fun runPing(): Int {
    val targets = listOf(
      "https://www.cloudflare.com",
      "https://www.google.com",
      "https://speed.cloudflare.com",
    )
    val samples = mutableListOf<Long>()

    targets.forEach { target ->
      try {
        val startedAt = System.currentTimeMillis()
        val connection = URL("$target/?_=$startedAt").openConnection() as HttpURLConnection
        connection.requestMethod = "HEAD"
        connection.connectTimeout = 2500
        connection.readTimeout = 2500
        connection.useCaches = false
        connection.connect()
        connection.responseCode
        connection.disconnect()
        samples.add(System.currentTimeMillis() - startedAt)
      } catch (_: Throwable) {}
    }

    return if (samples.isEmpty()) 0 else samples.average().toInt()
  }

  private fun runDownload(): DownloadResult {
    val startedAt = System.currentTimeMillis()
    val deadline = startedAt + DOWNLOAD_WINDOW_MS
    var totalBytes = 0L
    val buffer = ByteArray(64 * 1024)

    try {
      val connection = URL("https://speed.cloudflare.com/__down?bytes=25000000&_=$startedAt")
        .openConnection() as HttpURLConnection
      connection.requestMethod = "GET"
      connection.connectTimeout = 3000
      connection.readTimeout = 1500
      connection.useCaches = false

      BufferedInputStream(connection.inputStream).use { input ->
        while (System.currentTimeMillis() < deadline) {
          val read = input.read(buffer)
          if (read <= 0) break
          totalBytes += read
        }
      }
      connection.disconnect()
    } catch (_: Throwable) {}

    val elapsedSeconds = max((System.currentTimeMillis() - startedAt).toDouble() / 1000.0, 0.001)
    val mbps = (totalBytes.toDouble() * 8.0) / (elapsedSeconds * 1_000_000.0)
    return DownloadResult(
      speed = Math.round(mbps * 100.0) / 100.0,
      totalBytes = totalBytes,
      elapsedMs = (elapsedSeconds * 1000.0).toInt(),
    )
  }

  private fun runUpload(): TransferResult {
    val startedAt = System.currentTimeMillis()
    val deadline = startedAt + UPLOAD_WINDOW_MS
    var totalBytes = 0L
    val buffer = ByteArray(64 * 1024)

    try {
      val connection = URL("https://speed.cloudflare.com/__up?_=$startedAt")
        .openConnection() as HttpURLConnection
      connection.requestMethod = "POST"
      connection.connectTimeout = 3000
      connection.readTimeout = 1500
      connection.doOutput = true
      connection.useCaches = false
      connection.setRequestProperty("Content-Type", "application/octet-stream")
      connection.setChunkedStreamingMode(64 * 1024)

      BufferedOutputStream(connection.outputStream).use { output ->
        while (System.currentTimeMillis() < deadline) {
          output.write(buffer)
          totalBytes += buffer.size
        }
        output.flush()
      }
      connection.responseCode
      connection.disconnect()
    } catch (_: Throwable) {}

    val elapsedSeconds = max((System.currentTimeMillis() - startedAt).toDouble() / 1000.0, 0.001)
    val mbps = (totalBytes.toDouble() * 8.0) / (elapsedSeconds * 1_000_000.0)
    return TransferResult(
      speed = Math.round(mbps * 100.0) / 100.0,
      totalBytes = totalBytes,
      elapsedMs = (elapsedSeconds * 1000.0).toInt(),
    )
  }

  private fun saveResult(ping: Int, download: DownloadResult, upload: TransferResult) {
    val prefs = applicationContext.getSharedPreferences(
      ExpoBackgroundMonitorNotificationModule.PREFERENCES_NAME,
      Context.MODE_PRIVATE,
    )
    val stored = prefs.getString(ExpoBackgroundMonitorNotificationModule.NATIVE_HISTORY_KEY, "[]")
    val history = JSONArray(stored ?: "[]")
    val next = JSONArray()
    val now = System.currentTimeMillis()
    val cutoff = now - HISTORY_RETENTION_MS

    val result = JSONObject()
      .put("id", now.toString())
      .put("date", Instant.ofEpochMilli(now).toString())
      .put("timestamp", now)
      .put("download", download.speed)
      .put("ping", ping)
      .put("upload", upload.speed)
      .put("totalBytes", download.totalBytes + upload.totalBytes)
      .put("downloadBytes", download.totalBytes)
      .put("uploadBytes", upload.totalBytes)
      .put("durationMs", max(download.elapsedMs, upload.elapsedMs))
      .put("downloadDurationMs", download.elapsedMs)
      .put("uploadDurationMs", upload.elapsedMs)
      .put("source", "android-native-background")

    next.put(result)

    for (index in 0 until history.length()) {
      val item = history.optJSONObject(index) ?: continue
      val timestamp = item.optLong("timestamp", 0)
      if (timestamp >= cutoff && next.length() < HISTORY_LIMIT) {
        next.put(item)
      }
    }

    prefs.edit()
      .putString(ExpoBackgroundMonitorNotificationModule.NATIVE_HISTORY_KEY, next.toString())
      .apply()
  }

  private data class DownloadResult(
    val speed: Double,
    val totalBytes: Long,
    val elapsedMs: Int,
  )

  private data class TransferResult(
    val speed: Double,
    val totalBytes: Long,
    val elapsedMs: Int,
  )

  companion object {
    private const val DOWNLOAD_WINDOW_MS = 4000L
    private const val UPLOAD_WINDOW_MS = 4000L
    private const val HISTORY_LIMIT = 500
    private const val HISTORY_RETENTION_MS = 7L * 24L * 60L * 60L * 1000L
  }
}
