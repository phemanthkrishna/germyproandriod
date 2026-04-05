package com.getmypro.worker;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);

        // ── High-priority job alert channel (Zomato-style) ──────────────
        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmSound == null) {
            alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        }

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

        // ── General channel for lower-priority updates ───────────────────
        NotificationChannel generalChannel = new NotificationChannel(
                "general",
                "General Updates",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        generalChannel.setDescription("Order status updates and general notifications");
        nm.createNotificationChannel(generalChannel);
    }
}
