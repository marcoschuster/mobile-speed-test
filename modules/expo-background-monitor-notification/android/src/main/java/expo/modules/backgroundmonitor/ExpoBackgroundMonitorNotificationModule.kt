package expo.modules.backgroundmonitor

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

class ExpoBackgroundMonitorNotificationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoBackgroundMonitorNotification")

    AsyncFunction("showMonitoringNotificationAsync") { intervalLabel: String ->
      showMonitoringNotification(intervalLabel)
    }

    AsyncFunction("hideMonitoringNotificationAsync") {
      hideMonitoringNotification()
    }

    AsyncFunction("wasDisabledFromNotificationAsync") {
      wasDisabledFromNotification()
    }

    AsyncFunction("clearDisabledFromNotificationAsync") {
      clearDisabledFromNotification()
    }

    AsyncFunction("scheduleNativeMonitoringAsync") { intervalMinutes: Int ->
      scheduleNativeMonitoring(intervalMinutes)
    }

    AsyncFunction("cancelNativeMonitoringAsync") {
      cancelNativeMonitoring()
    }

    AsyncFunction("getNativeHistoryAsync") {
      getNativeHistory()
    }
  }

  private fun showMonitoringNotification(intervalLabel: String): Boolean {
    val context = appContext.reactContext ?: return false
    clearDisabledFromNotification()
    return showMonitoringNotification(context, intervalLabel)
  }

  private fun hideMonitoringNotification() {
    val context = appContext.reactContext ?: return
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  private fun scheduleNativeMonitoring(intervalMinutes: Int): Boolean {
    val context = appContext.reactContext ?: return false
    val clampedInterval = intervalMinutes.coerceAtLeast(15)
    val constraints = Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build()
    val request = PeriodicWorkRequestBuilder<BackgroundMonitorWorker>(
      clampedInterval.toLong(),
      TimeUnit.MINUTES,
    )
      .setConstraints(constraints)
      .build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
      WORK_NAME,
      ExistingPeriodicWorkPolicy.UPDATE,
      request,
    )

    context
      .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .edit()
      .putInt(INTERVAL_MINUTES_KEY, clampedInterval)
      .putLong(NEXT_RUN_AT_KEY, System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(clampedInterval.toLong()))
      .apply()

    return true
  }

  private fun cancelNativeMonitoring() {
    val context = appContext.reactContext ?: return
    WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    context
      .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove(NEXT_RUN_AT_KEY)
      .apply()
  }

  private fun getNativeHistory(): String {
    val context = appContext.reactContext ?: return "[]"
    return context
      .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .getString(NATIVE_HISTORY_KEY, "[]") ?: "[]"
  }

  private fun wasDisabledFromNotification(): Boolean {
    val context = appContext.reactContext ?: return false
    return context
      .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .getBoolean(DISABLED_KEY, false)
  }

  private fun clearDisabledFromNotification() {
    val context = appContext.reactContext ?: return
    context
      .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(DISABLED_KEY, false)
      .apply()
  }

  companion object {
    const val ACTION_TURN_OFF = "expo.modules.backgroundmonitor.ACTION_TURN_OFF"
    const val PREFERENCES_NAME = "background_monitor_notification"
    const val DISABLED_KEY = "disabled_from_notification"
    const val NATIVE_HISTORY_KEY = "native_background_history"
    const val INTERVAL_MINUTES_KEY = "interval_minutes"
    const val NEXT_RUN_AT_KEY = "next_run_at"
    const val CHANNEL_ID = "background_monitoring"
    const val NOTIFICATION_ID = 42031
    const val WORK_NAME = "background_speed_monitoring"

    fun showMonitoringNotification(context: Context, intervalLabel: String? = null): Boolean {
      if (!canPostNotifications(context)) {
        return false
      }

      ensureChannel(context)

      val prefs = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      val intervalMinutes = prefs.getInt(INTERVAL_MINUTES_KEY, 30).coerceAtLeast(15)
      val resolvedIntervalLabel = intervalLabel ?: "every ${intervalMinutes} min"
      val nextRunAt = prefs.getLong(NEXT_RUN_AT_KEY, 0L)
        .takeIf { it > System.currentTimeMillis() }
        ?: (System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(intervalMinutes.toLong())).also {
          prefs.edit().putLong(NEXT_RUN_AT_KEY, it).apply()
        }

      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: Intent()
      val launchPendingIntent = PendingIntent.getActivity(
        context,
        0,
        launchIntent,
        pendingIntentFlags(),
      )

      val turnOffIntent = Intent(context, BackgroundMonitorNotificationReceiver::class.java).apply {
        action = ACTION_TURN_OFF
      }
      val turnOffPendingIntent = PendingIntent.getBroadcast(
        context,
        1,
        turnOffIntent,
        pendingIntentFlags(),
      )

      val body = "Next check is estimated by Android scheduling. Tap Turn off to stop monitoring."
      val notification = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle("Continuous monitoring is on")
        .setContentText("Next check in about")
        .setStyle(NotificationCompat.BigTextStyle().bigText(
          "Running low-impact background speed checks $resolvedIntervalLabel. $body"
        ))
        .setContentIntent(launchPendingIntent)
        .setOngoing(true)
        .setShowWhen(true)
        .setWhen(nextRunAt)
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .addAction(0, "Turn off", turnOffPendingIntent)
        .build()

      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
      return true
    }

    fun updateNextRunEstimate(context: Context) {
      val prefs = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      val intervalMinutes = prefs.getInt(INTERVAL_MINUTES_KEY, 30).coerceAtLeast(15)
      prefs.edit()
        .putLong(NEXT_RUN_AT_KEY, System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(intervalMinutes.toLong()))
        .apply()
      showMonitoringNotification(context)
    }

    private fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return
      }

      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: return
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Continuous monitoring",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Shows when background speed monitoring is active."
        setShowBadge(false)
      }

      manager.createNotificationChannel(channel)
    }

    private fun canPostNotifications(context: Context): Boolean {
      return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
        ContextCompat.checkSelfPermission(
          context,
          Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun pendingIntentFlags(): Int {
      return PendingIntent.FLAG_UPDATE_CURRENT or
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    }
  }
}
