package com.saarathi.driver;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Saarathi Driver — the native side.
 *
 * The UI is the live driver console (Config.START), so the app always matches
 * the website pixel for pixel and updates the moment the site is deployed.
 * This shell only adds what a browser can't: a branded splash and offline
 * screen, system bars that follow the page colours, call / WhatsApp / UPI /
 * Google Maps hand-off, downloads, printing, photo uploads, and background
 * ride-request alerts (AlertService) while the app is closed.
 */
public class MainActivity extends Activity {
    /** Read by AlertService: skip system notifications while the console is on screen. */
    static volatile boolean visible;

    private static final int FILE_CHOOSER = 41;
    private static final int REQ_NOTIFICATIONS = 42;
    private static final int NIGHT = 0xFF0C0A09;
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String OFFLINE_URL = "https://" + ASSET_HOST + "/offline.html";
    private static final Uri SERVER = Uri.parse(Config.SERVER);

    /**
     * Injected after every full page load. It samples the colour at the very top
     * and bottom of the page so the status and navigation bars always blend in
     * (light console, dark sign-in band, dark mode, open sheets), reports route
     * changes made by the client-side router, and routes window.print() to
     * Android's print service.
     */
    private static final String SHIM = "(function(){"
            + "if(window.__sd)return;window.__sd=1;var B=window.SaarathiDriver;if(!B)return;"
            + "var cv=document.createElement('canvas');cv.width=cv.height=1;var cx=cv.getContext('2d',{willReadFrequently:true});"
            + "function rgba(c){cx.clearRect(0,0,1,1);cx.fillStyle='#000';cx.fillStyle=c;cx.fillRect(0,0,1,1);return cx.getImageData(0,0,1,1).data;}"
            + "function bg(el){while(el&&el.nodeType===1){var d=rgba(getComputedStyle(el).backgroundColor);if(d[3]>=128)return d[0]+','+d[1]+','+d[2];el=el.parentElement;}"
            + "var b=rgba(getComputedStyle(document.body).backgroundColor);return b[3]>=128?b[0]+','+b[1]+','+b[2]:'255,255,255';}"
            + "var t=0;function sample(){clearTimeout(t);t=setTimeout(function(){try{var w=innerWidth/2;"
            + "B.bars(bg(document.elementFromPoint(w,2)),bg(document.elementFromPoint(w,innerHeight-2)));}catch(e){}},80);}"
            + "function route(){try{B.route(location.pathname)}catch(e){}sample();setTimeout(sample,400);}"
            + "['pushState','replaceState'].forEach(function(k){var o=history[k];history[k]=function(){var r=o.apply(this,arguments);setTimeout(route,50);return r;};});"
            + "addEventListener('popstate',function(){setTimeout(route,50)});"
            + "new MutationObserver(sample).observe(document.documentElement,{attributes:true,attributeFilter:['class','style']});"
            + "new MutationObserver(sample).observe(document.body,{childList:true});"
            + "addEventListener('resize',sample);addEventListener('scroll',sample,{passive:true});"
            + "window.print=function(){B.print(document.title||'Saarathi Driver')};"
            + "route();"
            + "})();";

    /** Back button: first close whatever sheet, dialog or menu is open — exactly like pressing Esc. */
    private static final String CLOSE_OVERLAY = "(function(){var d=document.querySelector("
            + "'[role=dialog][data-state=open],[role=alertdialog][data-state=open],[role=menu][data-state=open],[data-slot=popover-content][data-state=open],#mobile-menu');"
            + "if(!d)return false;document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));"
            + "var b=document.querySelector('[aria-controls=mobile-menu][aria-expanded=true]');if(b)b.click();return true;})()";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private SharedPreferences prefs;
    private final Handler main = new Handler(Looper.getMainLooper());

    private boolean painted;               // first real frame is ready — release the splash
    private boolean offline;               // the offline page is on screen
    private boolean clearHistoryOnLoad;    // drop the offline page from history once back online
    private boolean loadFailed;            // the current main-frame load errored (don't treat it as a console page)
    private String lastUrl = Config.START;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("driver", MODE_PRIVATE);
        AlertService.createChannels(this);
        setBars(NIGHT, NIGHT);

        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(false); // the new-ride chime plays without a tap
        s.setSupportMultipleWindows(false);           // target=_blank opens in place (or in another app)
        s.setGeolocationEnabled(false);
        // Respect large system fonts, but cap them so cards and tab labels keep their layout.
        float scale = Math.min(getResources().getConfiguration().fontScale, 1.15f);
        s.setTextZoom(Math.round(scale * 100));
        s.setUserAgentString(s.getUserAgentString() + " SaarathiDriver/" + versionName());

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);

        web.addJavascriptInterface(new Bridge(), "SaarathiDriver");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener(this::download);

        setContentView(web);
        holdSplash();
        main.postDelayed(this::checkWebView, 1500);

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            load(targetOf(getIntent()));
        }
    }

    // ------------------------------------------------------------------ loading

    private void load(String url) {
        if (offline) clearHistoryOnLoad = true;
        offline = false;
        lastUrl = url;
        web.loadUrl(url);
    }

    private String targetOf(Intent intent) {
        String url = intent == null ? null : intent.getStringExtra("url");
        return url != null && isOwn(Uri.parse(url)) ? url : Config.START;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent.getStringExtra("url") != null) load(targetOf(intent));
    }

    /** Only the server this build was made for may load inside the app. */
    private static boolean isOwn(Uri u) {
        if (u == null || u.getHost() == null) return false;
        return u.getHost().equalsIgnoreCase(SERVER.getHost())
                && String.valueOf(u.getScheme()).equalsIgnoreCase(SERVER.getScheme())
                && port(u) == port(SERVER);
    }

    private static int port(Uri u) {
        if (u.getPort() != -1) return u.getPort();
        return "https".equalsIgnoreCase(u.getScheme()) ? 443 : 80;
    }

    /** Keep the launch screen up until the console has painted (max 8 s), so there is never a white flash. */
    private void holdSplash() {
        View content = findViewById(android.R.id.content);
        content.getViewTreeObserver().addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener() {
            @Override
            public boolean onPreDraw() {
                if (!painted) return false;
                content.getViewTreeObserver().removeOnPreDrawListener(this);
                return true;
            }
        });
        main.postDelayed(this::reveal, 8000);
    }

    private void reveal() {
        if (painted) return;
        painted = true;
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.WHITE));
        findViewById(android.R.id.content).invalidate();
    }

    private void showOffline() {
        offline = true;
        clearHistoryOnLoad = true;
        setBars(NIGHT, NIGHT);
        web.loadUrl(OFFLINE_URL);
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (isOwn(url)) return false;
            if (!request.isForMainFrame()) return false; // e.g. the Turnstile check stays in its iframe
            openExternal(url);
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!ASSET_HOST.equals(url.getHost())) return null; // everything else goes to the network
            String path = String.valueOf(url.getPath());
            try {
                if (path.equals("/offline.html")) {
                    byte[] html = offlineHtml().getBytes(StandardCharsets.UTF_8);
                    return new WebResourceResponse("text/html", "utf-8", new ByteArrayInputStream(html));
                }
                if (path.equals("/fonts/space-grotesk.woff2")) {
                    return new WebResourceResponse("font/woff2", null, getAssets().open("fonts/space-grotesk.woff2"));
                }
            } catch (IOException ignored) {
                // fall through to 404
            }
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (url != null && isOwn(Uri.parse(url))) {
                lastUrl = url;
                loadFailed = false;
            }
        }

        @Override
        public void onPageCommitVisible(WebView view, String url) {
            reveal();
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            reveal();
            if (url == null || !isOwn(Uri.parse(url)) || loadFailed || offline) return;
            if (clearHistoryOnLoad) {
                view.clearHistory();
                clearHistoryOnLoad = false;
            }
            view.evaluateJavascript(SHIM, null);
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
            // Route changes (sign-in/out) are reported by the SHIM from pages that really loaded.
            if (url != null && isOwn(Uri.parse(url)) && !loadFailed) lastUrl = url;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame() && !ASSET_HOST.equals(request.getUrl().getHost())) {
                loadFailed = true;
                showOffline();
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            int code = response.getStatusCode();
            // Gateway errors mean the server itself is down — show the branded screen, not the proxy's page.
            if (request.isForMainFrame() && code >= 502 && code <= 504) {
                loadFailed = true;
                showOffline();
            }
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // The page renderer crashed or was reclaimed: rebuild instead of taking the app down.
            ((ViewGroup) view.getParent()).removeView(view);
            view.destroy();
            web = null;
            recreate();
            return true;
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            List<String> mimes = new ArrayList<>();
            for (String entry : params.getAcceptTypes()) {
                for (String raw : entry.split(",")) {
                    String t = raw.trim().toLowerCase();
                    if (t.contains("/")) mimes.add(t);
                }
            }
            boolean imagesOnly = !mimes.isEmpty();
            for (String m : mimes) imagesOnly &= m.startsWith("image/");
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType(imagesOnly ? "image/*" : "*/*");
            if (!imagesOnly && !mimes.isEmpty()) pick.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toArray(new String[0]));
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(Intent.createChooser(pick, "Choose a photo"), FILE_CHOOSER);
                return true;
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null && clip.getItemCount() > 0) {
                    result = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[] {data.getData()};
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ------------------------------------------------------------ hand-offs

    /** Calls, WhatsApp, UPI, Google Maps, e-mail and other sites open in the phone's own apps. */
    private void openExternal(Uri url) {
        String scheme = url.getScheme() == null ? "" : url.getScheme().toLowerCase();
        Intent intent;
        try {
            switch (scheme) {
                case "tel":
                    intent = new Intent(Intent.ACTION_DIAL, url);
                    break;
                case "mailto":
                case "sms":
                case "smsto":
                    intent = new Intent(Intent.ACTION_SENDTO, url);
                    break;
                case "intent":
                    intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
                    intent.addCategory(Intent.CATEGORY_BROWSABLE);
                    intent.setComponent(null);
                    intent.setSelector(null);
                    break;
                case "javascript":
                case "file":
                case "content":
                case "data":
                case "about":
                    return; // never hand these to another app
                default:
                    intent = new Intent(Intent.ACTION_VIEW, url);
            }
        } catch (URISyntaxException e) {
            toast("This link can't be opened");
            return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            String fallback = intent.getStringExtra("browser_fallback_url");
            if (fallback != null && fallback.startsWith("https://")) {
                openExternal(Uri.parse(fallback));
                return;
            }
            String s = url.toString();
            toast(s.contains("wa.me") || s.contains("whatsapp") ? "WhatsApp is not installed"
                    : "upi".equals(scheme) ? "No UPI app found" : "No app can open this link");
        }
    }

    /** CSV exports and receipts go to Downloads with the signed-in session attached. */
    private void download(String url, String userAgent, String disposition, String mime, long length) {
        Uri uri = Uri.parse(url);
        if (!isOwn(uri)) {
            openExternal(uri);
            return;
        }
        if (Build.VERSION.SDK_INT < 29 && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {Manifest.permission.WRITE_EXTERNAL_STORAGE}, 43);
            toast("Allow storage access, then tap download again");
            return;
        }
        String name = URLUtil.guessFileName(url, disposition, mime);
        try {
            DownloadManager.Request req = new DownloadManager.Request(uri);
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null) req.addRequestHeader("Cookie", cookie);
            req.addRequestHeader("User-Agent", userAgent);
            req.setMimeType(mime);
            req.setTitle(name);
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
            toast("Downloading " + name);
        } catch (Exception e) {
            toast("Couldn't download " + name);
        }
    }

    // --------------------------------------------------------------- alerts

    /** Signed in → watch for ride requests in the background; signed out → stop. */
    private void onRoute(String path) {
        if (path == null || offline || loadFailed) return;
        if (path.startsWith("/admin/login")) {
            AlertService.stop(this);
        } else if (path.equals("/admin") || path.startsWith("/admin/")) {
            AlertService.start(this);
            askPermissionsOnce();
        }
    }

    private void askPermissionsOnce() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && !prefs.getBoolean("asked_notifications", false)) {
            prefs.edit().putBoolean("asked_notifications", true).apply();
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
            return; // the battery question follows the answer
        }
        askBatteryOnce();
    }

    /** Without this Android pauses the network in deep sleep and alerts arrive late. Asked once. */
    private void askBatteryOnce() {
        if (prefs.getBoolean("asked_battery", false)) return;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm == null || pm.isIgnoringBatteryOptimizations(getPackageName())) return;
        prefs.edit().putBoolean("asked_battery", true).apply();
        main.postDelayed(() -> {
            toast("Allow background use so ride alerts reach you instantly");
            try {
                startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
            } catch (ActivityNotFoundException ignored) {
                // some OEM builds hide this screen
            }
        }, 600);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQ_NOTIFICATIONS) askBatteryOnce();
    }

    // ------------------------------------------------------------ lifecycle

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (offline || web == null) {
            moveTaskToBack(true);
            return;
        }
        web.evaluateJavascript(CLOSE_OVERLAY, closed -> {
            if ("true".equals(closed)) return;
            if (web.canGoBack()) web.goBack();
            else moveTaskToBack(true);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        visible = true;
        AlertService.clearAlerts(this);
        if (web != null) {
            web.onResume();
            if (offline && isConnected()) load(lastUrl);
        }
    }

    @Override
    protected void onPause() {
        visible = false;
        CookieManager.getInstance().flush();
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null && !offline) web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        main.removeCallbacksAndMessages(null);
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /**
     * The console is built with modern CSS (Tailwind v4 needs Chromium 111+). Phones
     * normally keep "Android System WebView" updated through the Play Store; if this
     * one is behind, offer the update once per WebView version instead of showing a
     * subtly broken layout.
     */
    private void checkWebView() {
        PackageInfo pkg = WebView.getCurrentWebViewPackage();
        if (pkg == null || pkg.versionName == null) return;
        int major;
        try {
            major = Integer.parseInt(pkg.versionName.split("\\.")[0]);
        } catch (NumberFormatException e) {
            return;
        }
        String key = "webview_prompt_" + pkg.versionName;
        if (major >= 111 || prefs.getBoolean(key, false) || isFinishing()) return;
        prefs.edit().putBoolean(key, true).apply();
        new AlertDialog.Builder(this, R.style.AppDialog)
                .setTitle("Update Android System WebView")
                .setMessage("The driver console needs a newer version of Android System WebView (you have " + major
                        + "). Update it from the Play Store for the correct layout — it takes a minute and is free.")
                .setPositiveButton("Update", (d, w) -> openExternal(Uri.parse("market://details?id=" + pkg.packageName)))
                .setNegativeButton("Later", null)
                .show();
    }

    // -------------------------------------------------------------- helpers

    @SuppressWarnings("deprecation")
    private void setBars(int top, int bottom) {
        Window w = getWindow();
        w.setStatusBarColor(top);
        w.setNavigationBarColor(bottom);
        int flags = 0;
        if (isLight(top)) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (isLight(bottom)) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        w.getDecorView().setSystemUiVisibility(flags);
    }

    private static boolean isLight(int c) {
        return (0.2126 * Color.red(c) + 0.7152 * Color.green(c) + 0.0722 * Color.blue(c)) / 255 > 0.6;
    }

    private static int parseRgb(String rgb, int fallback) {
        try {
            String[] p = rgb.split(",");
            return Color.rgb(Integer.parseInt(p[0].trim()), Integer.parseInt(p[1].trim()), Integer.parseInt(p[2].trim()));
        } catch (Exception e) {
            return fallback;
        }
    }

    private boolean isConnected() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private String offlineHtml() throws IOException {
        boolean connected = isConnected();
        return readAsset("offline.html")
                .replace("{{TITLE}}", connected ? "Can’t reach the <span>console</span>" : "You’re <span>offline</span>")
                .replace("{{MESSAGE}}", connected
                        ? "The server isn’t responding right now. Your bookings are safe — try again in a moment."
                        : "Check your mobile data or Wi-Fi. New ride requests will show up as soon as you’re back.");
    }

    private String readAsset(String name) throws IOException {
        try (InputStream in = getAssets().open(name); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1";
        }
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    /** window.SaarathiDriver — called by the injected SHIM and the offline page only. */
    private class Bridge {
        @JavascriptInterface
        public void bars(String top, String bottom) {
            int t = parseRgb(top, Color.WHITE);
            int b = parseRgb(bottom, Color.WHITE);
            runOnUiThread(() -> {
                if (!offline) setBars(t, b);
            });
        }

        @JavascriptInterface
        public void route(String path) {
            runOnUiThread(() -> onRoute(path));
        }

        @JavascriptInterface
        public void print(String title) {
            runOnUiThread(() -> {
                if (web == null) return;
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                String job = title == null || title.isEmpty() ? "Saarathi Driver" : title;
                pm.print(job, web.createPrintDocumentAdapter(job), new PrintAttributes.Builder().build());
            });
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> {
                if (web != null) load(lastUrl);
            });
        }

        @JavascriptInterface
        public String version() {
            return versionName();
        }
    }
}
