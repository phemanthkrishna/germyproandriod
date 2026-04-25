package com.getmypro.worker;

import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Full-screen activity that shows over the lock screen when a new job
 * alert arrives — similar to how Zomato / Swiggy show delivery requests.
 *
 * Auto-dismisses after 30 seconds.
 */
public class FullScreenJobActivity extends AppCompatActivity {

    private static final int AUTO_DISMISS_MS = 30_000;
    private static final int JOB_NOTIFICATION_ID = 9001;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        String title   = getIntent().getStringExtra("title");
        String body    = getIntent().getStringExtra("body");
        String orderId = getIntent().getStringExtra("orderId");

        if (title == null) title = "New Job Available!";
        if (body == null)  body = "Tap to view and accept";

        // Build UI programmatically (no XML layout needed)
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#0F172A")); // slate-950
        root.setPadding(dp(24), dp(48), dp(24), dp(48));

        // Pulsing indicator
        TextView indicator = new TextView(this);
        indicator.setText("INCOMING JOB");
        indicator.setTextColor(Color.parseColor("#F97316")); // orange-500
        indicator.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        indicator.setTypeface(Typeface.DEFAULT_BOLD);
        indicator.setLetterSpacing(0.2f);
        indicator.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams indicatorLP = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        indicatorLP.bottomMargin = dp(24);
        root.addView(indicator, indicatorLP);

        // Wrench emoji
        TextView emoji = new TextView(this);
        emoji.setText("\uD83D\uDD27"); // wrench emoji
        emoji.setTextSize(TypedValue.COMPLEX_UNIT_SP, 72);
        emoji.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams emojiLP = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        emojiLP.bottomMargin = dp(24);
        root.addView(emoji, emojiLP);

        // Title
        TextView titleTV = new TextView(this);
        titleTV.setText(title);
        titleTV.setTextColor(Color.WHITE);
        titleTV.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        titleTV.setTypeface(Typeface.DEFAULT_BOLD);
        titleTV.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleLP = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        titleLP.bottomMargin = dp(12);
        root.addView(titleTV, titleLP);

        // Body
        TextView bodyTV = new TextView(this);
        bodyTV.setText(body);
        bodyTV.setTextColor(Color.parseColor("#94A3B8")); // slate-400
        bodyTV.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        bodyTV.setGravity(Gravity.CENTER);
        bodyTV.setLineSpacing(dp(4), 1f);
        LinearLayout.LayoutParams bodyLP = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bodyLP.bottomMargin = dp(12);
        root.addView(bodyTV, bodyLP);

        // Earnings badge
        TextView earnings = new TextView(this);
        earnings.setText("\uD83D\uDCB0 \u20B9100 guaranteed visit charge");
        earnings.setTextColor(Color.parseColor("#4ADE80")); // green-400
        earnings.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        earnings.setTypeface(Typeface.DEFAULT_BOLD);
        earnings.setGravity(Gravity.CENTER);
        GradientDrawable earningsBg = new GradientDrawable();
        earningsBg.setColor(Color.parseColor("#1A3A2A"));
        earningsBg.setCornerRadius(dp(12));
        earnings.setBackground(earningsBg);
        earnings.setPadding(dp(16), dp(12), dp(16), dp(12));
        LinearLayout.LayoutParams earningsLP = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        earningsLP.bottomMargin = dp(40);
        root.addView(earnings, earningsLP);

        // Buttons row
        LinearLayout btnRow = new LinearLayout(this);
        btnRow.setOrientation(LinearLayout.HORIZONTAL);
        btnRow.setGravity(Gravity.CENTER);

        // View Job button (green)
        Button viewBtn = new Button(this);
        viewBtn.setText("VIEW JOB");
        viewBtn.setTextColor(Color.WHITE);
        viewBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        viewBtn.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable greenBg = new GradientDrawable();
        greenBg.setColor(Color.parseColor("#22C55E")); // green-500
        greenBg.setCornerRadius(dp(16));
        viewBtn.setBackground(greenBg);
        viewBtn.setPadding(dp(32), dp(16), dp(32), dp(16));
        viewBtn.setAllCaps(false);
        final String fOrderId = orderId;
        viewBtn.setOnClickListener(v -> {
            dismissNotification();
            Intent intent = new Intent(FullScreenJobActivity.this, MainActivity.class);
            intent.putExtra("screen", "job");
            intent.putExtra("orderId", fOrderId);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
            finish();
        });
        LinearLayout.LayoutParams viewLP = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        viewLP.rightMargin = dp(8);
        btnRow.addView(viewBtn, viewLP);

        // Dismiss button (dark)
        Button dismissBtn = new Button(this);
        dismissBtn.setText("DISMISS");
        dismissBtn.setTextColor(Color.parseColor("#94A3B8"));
        dismissBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        dismissBtn.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable darkBg = new GradientDrawable();
        darkBg.setColor(Color.parseColor("#1E293B")); // slate-800
        darkBg.setCornerRadius(dp(16));
        darkBg.setStroke(dp(1), Color.parseColor("#334155")); // slate-700
        dismissBtn.setBackground(darkBg);
        dismissBtn.setPadding(dp(32), dp(16), dp(32), dp(16));
        dismissBtn.setAllCaps(false);
        dismissBtn.setOnClickListener(v -> {
            dismissNotification();
            finish();
        });
        LinearLayout.LayoutParams dismissLP = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        dismissLP.leftMargin = dp(8);
        btnRow.addView(dismissBtn, dismissLP);

        LinearLayout.LayoutParams btnRowLP = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        root.addView(btnRow, btnRowLP);

        setContentView(root);

        // Auto-dismiss after 30s
        handler.postDelayed(this::finish, AUTO_DISMISS_MS);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
    }

    private void dismissNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(JOB_NOTIFICATION_ID);
    }

    private int dp(float dp) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, dp, getResources().getDisplayMetrics()
        );
    }
}
