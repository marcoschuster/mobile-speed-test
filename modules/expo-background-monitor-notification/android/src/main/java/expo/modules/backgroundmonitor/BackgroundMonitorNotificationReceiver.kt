package expo.modules.backgroundmonitor

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.WorkManager

class BackgroundMonitorNotificationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ExpoBackgroundMonitorNotificationModule.ACTION_TURN_OFF) {
      return
    }

    context
      .getSharedPreferences(ExpoBackgroundMonitorNotificationModule.PREFERENCES_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(ExpoBackgroundMonitorNotificationModule.DISABLED_KEY, true)
      .apply()

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
    manager?.cancel(ExpoBackgroundMonitorNotificationModule.NOTIFICATION_ID)

    WorkManager.getInstance(context)
      .cancelUniqueWork(ExpoBackgroundMonitorNotificationModule.WORK_NAME)
  }
}
