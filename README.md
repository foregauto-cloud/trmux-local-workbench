# Trmux Local Workbench

The public repository includes a local-first browser workspace plus an experimental native Android WireGuard controller under `android/`.

## Build the Android APK in Termux

The Android app supports a user-confirmed APK update flow. Android does not allow an app to hot-patch its running code or silently replace itself. Build a new APK with the **same signing key** and a higher `versionCode`, install it through Android's package installer, and Android updates the installed app while preserving app data. The process restarts as part of installation. Disconnect the VPN first.

To update an app built and installed from this same Termux environment, pull the latest code and build with the helper:

```sh
cd ~/trmux-local-workbench
git pull --ff-only
./android/build-termux.sh
```

Keep the same Termux user and `~/.android/debug.keystore`; losing/replacing that debug key means Android will reject the update signature. Then copy the APK to Downloads and open it to upgrade manually:

```sh
cp android/app/build/outputs/apk/debug/app-debug.apk "$HOME/storage/downloads/"
```

Alternatively, use **Install app update from APK** in Trmux, select the built APK, and confirm the Android installer prompt. Android may ask to allow this app to install unknown apps. The installer validates package ID, signature, and version; updates must use package `org.trmux.app`, the same signing certificate, and a higher version code. Never install an APK from an untrusted source.

Termux build prerequisites (once): OpenJDK 21, Gradle, native Termux `aapt2`, and Android SDK platform 35/build-tools 34.0.0. If needed:

```sh
pkg install openjdk-21 gradle aapt2
export JAVA_HOME="$PREFIX/lib/jvm/java-21-openjdk"
export ANDROID_HOME="$HOME/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
"$ANDROID_HOME/cmdline-tools/latest/cmdline-tools/bin/sdkmanager" --sdk_root="$ANDROID_HOME" --licenses
"$ANDROID_HOME/cmdline-tools/latest/cmdline-tools/bin/sdkmanager" --sdk_root="$ANDROID_HOME" \
  "platforms;android-35" "build-tools;34.0.0" "platform-tools"
chmod +x android/build-termux.sh
./android/build-termux.sh
```

## Native Android VPN app (WireGuard)

The `android/` subproject imports a user-selected WireGuard configuration, parses it with the official WireGuard tunnel library, encrypts configuration at rest using Android Keystore-backed AES-GCM, and requests Android's explicit `VpnService.prepare()` consent before connecting. Disconnect is user-controlled. This is an experimental minimal controller, not an audited VPN product. Test connect/disconnect and permission-denial behavior on a spare device before using sensitive traffic.

Current native support is **WireGuard only**. OpenVPN/SOCKS5/HTTP CONNECT profiles in the browser app are drafts, not active connections. No proxy chaining, endpoint rotation, relay mesh, stealth, or automatic traffic redirection is included. VPN routes and DNS come from the imported WireGuard configuration; inspect them with the provider before approving a connection. An app cannot control arbitrary firmware or bypass Android's system permissions.

## Web workspace and Termux

Requires Node.js 18+:

```sh
git clone https://github.com/foregauto-cloud/trmux-local-workbench.git
cd trmux-local-workbench
npm start
```

Open http://127.0.0.1:3000. No account is needed for editor, local log triage, or browser-only profile drafts. The browser app cannot activate a VPN. The server binds to loopback, does not execute code or shell commands, and its optional assistant calls only a preinstalled model on local Ollama.
