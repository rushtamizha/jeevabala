# Saarathi Driver (Android)

The driver console as an Android app. It opens `/admin` on your live website
inside a native shell, so every screen, colour and interaction is **exactly
the website's**: dashboard, ride requests, schedule, payments, customers,
fleet, settings. Deploy the site and the app updates instantly. There is no
separate app release for UI changes.

What the native shell adds:

| | |
| --- | --- |
| **Ride alerts when the app is closed** | While you're signed in, a small "You're online" service checks for new ride requests and reported payments (every 20 s with the screen on, every 60 s in your pocket). New ones arrive as heads-up notifications with sound and vibration. Tap one to open that booking. It stops when you sign out, or when you tap **Stop alerts** on the notification. |
| **Launch screen & offline screen** | Night background with the logo, then straight into the console. No white flash. If the internet drops, a branded "You're offline" screen appears and reconnects by itself. |
| **System bars that match the page** | Status and navigation bars take the colour of whatever is at the top and bottom of the screen: light console, dark sign-in band, dark mode, open sheets. |
| **Phone hand-off** | Call, WhatsApp, UPI and **Navigate** (Google Maps directions to the pickup) open the right app. Other websites open in the browser. |
| **Downloads, printing, uploads** | CSV exports save to Downloads, and Print opens Android's print/PDF dialog. Vehicle and hero photos can be picked from the gallery. |
| **Back button** | Closes an open sheet, menu or dialog first, then goes back, then leaves the app. |
| **WebView check** | If the phone's *Android System WebView* is older than 111, the app offers a one-tap Play Store update (older versions misplace some icons). |

## Build

```bash
cp driver.env.example driver.env      # set SERVER_URL=https://yourdomain.in once
./build-apk.sh                        # → dist/SaarathiDriver-v<version>.apk
./build-apk.sh install                # build + install on a USB-connected phone
```

`SERVER_URL` must be your site's `APP_URL` (the same https origin). Sign-in and
the site's cross-site-request protection both depend on it. Only `https://`
is accepted, apart from `http://localhost` test builds.

Needs a JDK and Android SDK build-tools 35 + platform 34
(`~/Library/Android/sdk`). No Gradle, no Android Studio, the same toolchain
as Wepzite CRM.

For an update to the native shell (not needed for website changes), bump
`VERSION_NAME` and `VERSION_CODE` in `build-apk.sh`, build, and install over
the old app.

## Try it before the site is live (USB)

1. Start the site locally (`npm run dev` on port 3000) and plug in the phone
   with USB debugging on.
2. Run:
   ```bash
   adb reverse tcp:3000 tcp:3000
   SERVER_URL=http://localhost:3000 ./build-apk.sh install
   ```
   The phone's `localhost:3000` now reaches your Mac. This test build only
   works while the cable is connected.

## Install on a phone

Send the APK to the phone (WhatsApp it to yourself, Drive or USB), open it, and
allow "Install unknown apps" for the app you opened it from. On first sign-in
the app asks for two things. Allow both, or alerts arrive late or not at all:

- **Notifications**: for the ride-request alerts.
- **Background use** ("Allow app to always run in background"): otherwise
  Android pauses the network in deep sleep.

Keep the Telegram bot alerts in *Admin → Integrations* switched on as a second
channel. They use Telegram's own push service and reach you even if Android
kills the app.

## ⚠️ The signing key (`keys/`)

Android only installs an update signed with the same key. No bookings or data
live on the phone (everything is on the server), so losing the key only means
uninstalling and signing in again. Still, back up `keys/` (Drive + pen drive)
and never commit it. It's in `.gitignore`.

## How it works

| Part | Where |
| --- | --- |
| WebView shell: host lock, hand-offs, bars, splash, offline, downloads, print, uploads | `android/src/com/saarathi/driver/MainActivity.java` |
| Background ride alerts (foreground service polling `/api/admin/live` with the console's session cookie) | `android/src/com/saarathi/driver/AlertService.java` |
| Restart alerts after reboot / app update, "Stop alerts" action | `android/src/com/saarathi/driver/BootReceiver.java` |
| Offline screen (same tokens as `src/app/globals.css`, Space Grotesk bundled) | `android/assets/offline.html` |
| Icon, splash, colours (vector logo from `src/components/brand/logo.tsx`) | `android/res/` |
| Server URL, network security config (generated per build) | `build-apk.sh` → `build/gen`, `build/genres` |

Security: the WebView only loads the one server this build was made for. Every
other link is handed to another app. There is no file or content access and no
mixed content, only HTTPS with the system's certificate authorities, and cookies
are first-party only.
