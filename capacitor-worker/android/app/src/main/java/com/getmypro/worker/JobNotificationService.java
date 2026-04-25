package com.getmypro.worker;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Custom FCM service that extends the Capacitor Firebase Messaging plugin's
 * MessagingService. This ensures:
 *   - Job alerts (screen=job) get the full-screen Zomato-style treatment
 *   - ALL other messages are forwarded to the Capacitor plugin (super) so
 *     JS listeners, token refresh, and normal notifications still work
 */
public class JobNotificationService
        extends io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService {

    private static final int JOB_NOTIFICATION_ID = 9001;

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        String screen = data.get("screen");

        // Only intercept messages explicitly flagged for full-screen display
        if ("true".equals(data.get("fullscreen")) && data.get("orderId") != null) {
            String title = data.containsKey("title") ? data.get("title") : "New Job Available!";
            String body  = data.containsKey("body")  ? data.get("body")  : "Tap to view and accept";
            showFullScreenNotification(title, body, data.get("orderId"));
        }

        // ALWAYS forward to Capacitor plugin so JS listeners fire
        super.onMessageReceived(message);
    }

    private void showFullScreenNotification(String title, String body, String orderId) {
        Context ctx = getApplicationContext();

        // Wake the screen
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        if (pm != null && !pm.isInteractive()) {
            PowerManager.WakeLock wl = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                "getmypro:jobalert"
            );
            wl.acquire(10_000); // 10s
        }

        // Full-screen activity intent (shows over lock screen)
        Intent fullScreenIntent = new Intent(ctx, FullScreenJobActivity.class);
        fullScreenIntent.putExtra("title", title);
        fullScreenIntent.putExtra("body", body);
        fullScreenIntent.putExtra("orderId", orderId);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent fullScreenPI = PendingIntent.getActivity(ctx, 0, fullScreenIntent, flags);

        // Tap intent — opens the main app to the job detail
        Intent tapIntent = new Intent(ctx, MainActivity.class);
        tapIntent.putExtra("screen", "job");
        tapIntent.putExtra("orderId", orderId);
        tapIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tapPI = PendingIntent.getActivity(ctx, 1, tapIntent, flags);

        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, "job_alerts")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(tapPI)
            .setFullScreenIntent(fullScreenPI, true)
            .setSound(alarmSound, android.media.AudioManager.STREAM_RING)
            .setVibrate(new long[]{0, 500, 200, 500, 200, 500})
            .setTimeoutAfter(35_000); // auto-dismiss after 35s

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(JOB_NOTIFICATION_ID, builder.build());
        }
    }
}
