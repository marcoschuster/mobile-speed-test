package expo.modules.traceroute

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

class ExpoTracerouteModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoTraceroute")

    AsyncFunction("traceRouteAsync") { host: String, maxHops: Int, timeoutMs: Int ->
      traceRoute(host, maxHops, timeoutMs)
    }
  }

  private fun traceRoute(host: String, maxHops: Int, timeoutMs: Int): List<Map<String, Any?>> {
    val safeHost = host.trim()
    if (safeHost.isEmpty()) {
      return emptyList()
    }

    val hops = mutableListOf<Map<String, Any?>>()
    val cappedHops = maxHops.coerceIn(1, 15)
    val hopTimeoutMs = timeoutMs.coerceIn(500, 1500)

    for (ttl in 1..cappedHops) {
      val hop = runHop(safeHost, ttl, hopTimeoutMs)
      hops.add(hop)
      if (hop["reached"] == true) {
        break
      }
    }

    return hops
  }

  private fun runHop(host: String, ttl: Int, timeoutMs: Int): Map<String, Any?> {
    val timeoutSeconds = maxOf(1, timeoutMs / 1000)
    val command = listOf(
      "/system/bin/ping",
      "-c", "1",
      "-W", timeoutSeconds.toString(),
      "-t", ttl.toString(),
      host,
    )

    return try {
      val process = ProcessBuilder(command)
        .redirectErrorStream(true)
        .start()

      val finished = process.waitFor((timeoutMs + 250).toLong(), TimeUnit.MILLISECONDS)
      if (!finished) {
        process.destroyForcibly()
        return timeoutHop(ttl)
      }

      val output = BufferedReader(InputStreamReader(process.inputStream)).use { reader ->
        reader.readLines().joinToString("\n")
      }

      val ip = extractIp(output) ?: "*"
      val rtt = extractRtt(output)
      val reached = process.exitValue() == 0 && output.contains("bytes from", ignoreCase = true)

      mapOf(
        "hop" to ttl,
        "ip" to ip,
        "rtt" to rtt,
        "timeout" to false,
        "reached" to reached,
      )
    } catch (_: Throwable) {
      timeoutHop(ttl)
    }
  }

  private fun extractIp(output: String): String? {
    val pattern = Pattern.compile("(?:from|From)\\s+((?:\\d{1,3}\\.){3}\\d{1,3})")
    val matcher = pattern.matcher(output)
    return if (matcher.find()) matcher.group(1) else null
  }

  private fun extractRtt(output: String): Double? {
    val pattern = Pattern.compile("time[=<]([0-9.]+)")
    val matcher = pattern.matcher(output)
    return if (matcher.find()) matcher.group(1)?.toDoubleOrNull() else null
  }

  private fun timeoutHop(ttl: Int): Map<String, Any?> {
    return mapOf(
      "hop" to ttl,
      "ip" to "*",
      "rtt" to null,
      "timeout" to true,
      "reached" to false,
    )
  }
}
