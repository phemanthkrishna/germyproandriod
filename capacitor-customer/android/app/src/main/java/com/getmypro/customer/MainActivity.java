package com.getmypro.customer;

import android.app.NotificationChannel;
import android.app.NotificationManager;
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

        // Order updates — high importance so banners appear
        NotificationChannel orderChannel = new NotificationChannel(
                "order_updates",
                "Order Updates",
                NotificationManager.IMPORTANCE_HIGH
        );
        orderChannel.setDescription("Notifications for worker assignment, quotes, and job completion");
        orderChannel.enableLights(true);
        orderChannel.enableVibration(true);
        nm.createNotificationChannel(orderChannel);

        // General channel
        NotificationChannel generalChannel = new NotificationChannel(
                "general",
                "General",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        nm.createNotificationChannel(generalChannel);
    }
}
