# Trmux Local Workbench

The public repository includes a local-first browser workspace plus an experimental native Android WireGuard controller under `android/`.

## Build the Android APK in Termux

The earlier Android Gradle Plugin error with `AAPT2 ... linux` is a host-binary mismatch: the downloaded AAPT2 executable targets desktop Linux/glibc, while Termux uses Android/Bionic. The build helper uses Termux's native `aapt2` and checks Java and SDK prerequisites. From the repository root:

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

The script writes `android.aapt2FromMavenOverride` to your user-level `~/.gradle/gradle.properties`, keeping Termux-specific paths out of the shared project configuration. If needed, set `ANDROID_HOME` to your actual SDK location. After a successful build, it prints the APK path. Copy it to shared Downloads only after verifying it exists:

```sh
cp android/app/build/outputs/apk/debug/app-debug.apk "$HOME/storage/downloads/"
```

Then use Android's file manager to install it, allowing installs from that source if Android prompts. If native AAPT2 itself fails, use Android Studio on a desktop or a configured Android CI runner; Termux binary compatibility varies. `local.properties` is local-only and must not be committed.

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
