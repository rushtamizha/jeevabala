package com.saarathi.driver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restarts ride alerts after a reboot or app update, and handles the "Stop alerts" action. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (AlertService.ACTION_STOP.equals(intent.getAction())) {
            AlertService.stop(context);
            return;
        }
        if (context.getSharedPreferences("driver", Context.MODE_PRIVATE).getBoolean("alerts", false)) {
            AlertService.start(context);
        }
    }
}
