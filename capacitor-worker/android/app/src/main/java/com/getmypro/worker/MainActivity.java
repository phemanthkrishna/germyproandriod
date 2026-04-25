package com.getmypro.worker;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Pending navigation from a notification tap intent
    private String pendingScreen  = null;
    private String pendingOrderId = null;

    private static final int REQ_NOTIFICATION_PERMISSION = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        requestNotificationPermission();
        handleNotificationIntent(getIntent());
    }

    /** Ask for POST_NOTIFICATIONS on Android 13+ directly — more reliable than the Capacitor plugin. */
    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) return;
        ActivityCompat.requestPermissions(
            this,
            new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
            REQ_NOTIFICATION_PERMISSION
        );
    }

    /** After user grants permission, tell the web app to re-fetch the FCM token. */
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIFICATION_PERMISSION
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED
                && bridge != null) {
            bridge.getWebView().postDelayed(
                () -> bridge.getWebView().evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('notificationPermissionGranted'));", null),
                300
            );
        }
    }

    /** Called when app is already running and a new intent arrives (notification tap while backgrounded) */
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    /** Fires after onCreate/onNewIntent — dispatch navigation once WebView is ready */
    @Override
    public void onResume() {
        super.onResume();
        dispatchPendingNavigation();
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        String screen  = intent.getStringExtra("screen");
        String orderId = intent.getStringExtra("orderId");
        if (screen == null) return;
        pendingScreen  = screen;
        pendingOrderId = orderId;
    }

    private void dispatchPendingNavigation() {
        if (pendingScreen == null || bridge == null) return;

        final String screen  = pendingScreen;
        final String orderId = pendingOrderId != null ? pendingOrderId : "";
        pendingScreen  = null;
        pendingOrderId = null;

        // Dispatch a custom DOM event so the JS layer can navigate
        final String json = "{\"screen\":\"" + screen + "\",\"orderId\":\"" + orderId + "\"}";
        final String js   = "window.dispatchEvent(new CustomEvent('nativeNotificationTap',{detail:" + json + "}));";

        // Delay 600 ms to let the WebView finish loading before firing the event
        bridge.getWebView().postDelayed(
            () -> bridge.getWebView().evaluateJavascript(js, null),
            600
        );
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);

        // ── High-priority job alert channel (full-screen, ringtone) ─────────
        // Used ONLY by JobNotificationService for new-job / preferred-worker alerts.
        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        AudioAttributes audioAttr = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        NotificationChannel jobChannel = new NotificationChannel(
                "job_alerts",
                "New Job Alerts",
                NotificationManager.IMPORTANCE_HIGH
        );
        jobChannel.setDescription("High-priority alerts for incoming job requests");
        jobChannel.enableLights(true);
        jobChannel.enableVibration(true);
        jobChannel.setVibrationPattern(new long[]{0, 400, 150, 400, 150, 400});
        jobChannel.setSound(alarmSound, audioAttr);
        jobChannel.setShowBadge(true);
        nm.createNotificationChannel(jobChannel);

        // ── General channel for all other updates (heads-up, default sound) ──
        // High importance so notifications appear as heads-up banners,
        // but no custom sound — just the regular notification tone.
        NotificationChannel generalChannel = new NotificationChannel(
                "general",
                "Job Updates",
                NotificationManager.IMPORTANCE_HIGH
        );
        generalChannel.setDescription("Order status updates and general notifications");
        generalChannel.enableVibration(true);
        // No setSound() call → Android uses the default notification sound
        nm.createNotificationChannel(generalChannel);
    }
}
