package com.saarathi.driver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import android.service.notification.StatusBarNotification;
import android.webkit.CookieManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * "You're online": while the driver is signed in, this foreground service polls
 * the same endpoint the console uses (/api/admin/live) with the console's own
 * session cookie, and raises a heads-up notification with sound for every new
 * ride request or reported payment — even when the app is closed or the phone
 * is locked. It stops by itself when the session ends (401) or the driver taps
 * "Stop alerts"; opening the console starts it again.
 */
public class AlertService extends Service {
    static final String CH_ALERTS = "ride_alerts";
    static final String CH_ONLINE = "online";
    static final String ACTION_STOP = "com.saarathi.driver.STOP_ALERTS";
    private static final int ID_ONLINE = 1;
    private static final int BRAND = 0xFFFB5B21;
    private static final long SCREEN_ON_MS = 20_000;  // matches the console's own refresh
    private static final long SCREEN_OFF_MS = 60_000; // gentler on the battery in a pocket

    static volatile boolean running;

    private HandlerThread thread;
    private Handler handler;
    private PowerManager.WakeLock wake;
    private int lastPending = -1;
    private int lastClaims = -1;
    private int failures;

    static void createChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel alerts = new NotificationChannel(CH_ALERTS, "Ride requests", NotificationManager.IMPORTANCE_HIGH);
        alerts.setDescription("New ride requests and payments to verify");
        alerts.enableVibration(true);
        alerts.setVibrationPattern(new long[] {0, 400, 180, 400});
        alerts.enableLights(true);
        alerts.setLightColor(BRAND);
        alerts.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        NotificationChannel online = new NotificationChannel(CH_ONLINE, "Online status", NotificationManager.IMPORTANCE_MIN);
        online.setDescription("Shown while the app is watching for ride requests");
        online.setShowBadge(false);
        nm.createNotificationChannel(alerts);
        nm.createNotificationChannel(online);
    }

    static void start(Context c) {
        c.getSharedPreferences("driver", MODE_PRIVATE).edit().putBoolean("alerts", true).apply();
        if (running) return;
        try {
            c.startForegroundService(new Intent(c, AlertService.class));
        } catch (Exception ignored) {
            // Android refuses background starts in some states; the next app open retries.
        }
    }

    static void stop(Context c) {
        c.getSharedPreferences("driver", MODE_PRIVATE).edit().putBoolean("alerts", false).apply();
        c.stopService(new Intent(c, AlertService.class));
    }

    /** Opening the console clears ride alerts — they're on screen now. */
    static void clearAlerts(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        for (StatusBarNotification n : nm.getActiveNotifications()) {
            if (n.getId() != ID_ONLINE) nm.cancel(n.getId());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        goForeground(ongoing("Watching for ride requests"));
        if (!running) {
            running = true;
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null) {
                wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SaarathiDriver:alerts");
                wake.setReferenceCounted(false);
                wake.acquire();
            }
            thread = new HandlerThread("ride-alerts");
            thread.start();
            handler = new Handler(thread.getLooper());
            handler.post(tick);
        }
        return START_STICKY;
    }

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            poll();
            if (!running) return;
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            handler.postDelayed(this, pm != null && pm.isInteractive() ? SCREEN_ON_MS : SCREEN_OFF_MS);
        }
    };

    private void poll() {
        String cookie;
        try {
            cookie = CookieManager.getInstance().getCookie(Config.SERVER);
        } catch (Exception e) {
            return; // WebView not ready yet — try next tick
        }
        if (cookie == null || cookie.isEmpty()) {
            signedOut();
            return;
        }
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(Config.SERVER + "/api/admin/live").openConnection();
            con.setConnectTimeout(10_000);
            con.setReadTimeout(10_000);
            con.setRequestProperty("Cookie", cookie);
            con.setRequestProperty("Accept", "application/json");
            con.setRequestProperty("User-Agent", "SaarathiDriver/" + Config.VERSION);
            int code = con.getResponseCode();
            if (code == 401 || code == 403) {
                signedOut();
                return;
            }
            if (code != 200) {
                failed();
                return;
            }
            JSONObject j = new JSONObject(read(con.getInputStream()));
            int pending = j.optInt("pending");
            int claims = j.optInt("paymentClaims");
            JSONArray alerts = j.optJSONArray("alerts");
            JSONObject top = alerts != null && alerts.length() > 0 ? alerts.optJSONObject(0) : null;
            if (lastPending >= 0 && !MainActivity.visible) {
                if (pending > lastPending) notifyRide("New ride request", top);
                else if (claims > lastClaims) notifyRide("Payment reported", top);
            }
            lastPending = pending;
            lastClaims = claims;
            failures = 0;
            update(pending == 0 ? "Watching for ride requests"
                    : pending + (pending == 1 ? " request waiting for you" : " requests waiting for you"));
        } catch (Exception e) {
            failed();
        } finally {
            if (con != null) con.disconnect();
        }
    }

    private void failed() {
        if (++failures == 3) update("Reconnecting…");
    }

    private void signedOut() {
        running = false;
        stop(this);
        stopSelf();
    }

    private void notifyRide(String title, JSONObject top) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        String body = top != null ? top.optString("code") + " · " + top.optString("name") : "Open the console to respond";
        String url = top != null && !top.optString("bookingId").isEmpty() ? Config.SERVER + "/admin/bookings/" + top.optString("bookingId") : Config.START;
        int id = 1000 + (int) (System.currentTimeMillis() % 100_000);
        Notification locked = new Notification.Builder(this, CH_ALERTS)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(BRAND)
                .setContentTitle(title)
                .setContentText("Unlock to see the details")
                .build();
        Notification n = new Notification.Builder(this, CH_ALERTS)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(BRAND)
                .setContentTitle(title)
                .setContentText(body)
                .setCategory(Notification.CATEGORY_EVENT)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setPublicVersion(locked)
                .setAutoCancel(true)
                .setContentIntent(openApp(url, id))
                .build();
        nm.notify(id, n);
    }

    private Notification ongoing(String text) {
        Intent stop = new Intent(this, BootReceiver.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getBroadcast(this, 1, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, CH_ONLINE)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(BRAND)
                .setContentTitle("You’re online")
                .setContentText(text)
                .setOngoing(true)
                .setShowWhen(false)
                .setContentIntent(openApp(null, 0))
                .addAction(new Notification.Action.Builder((Icon) null, "Stop alerts", stopPi).build())
                .build();
    }

    private void update(String text) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null && running) nm.notify(ID_ONLINE, ongoing(text));
    }

    private void goForeground(Notification n) {
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID_ONLINE, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(ID_ONLINE, n);
    }

    private PendingIntent openApp(String url, int requestCode) {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (url != null) open.putExtra("url", url);
        return PendingIntent.getActivity(this, requestCode, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static String read(InputStream in) throws java.io.IOException {
        try (InputStream s = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = s.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    @Override
    public void onDestroy() {
        running = false;
        if (handler != null) handler.removeCallbacksAndMessages(null);
        if (thread != null) thread.quitSafely();
        if (wake != null && wake.isHeld()) wake.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
