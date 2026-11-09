# Trmux Local Workbench

The public repository includes a local-first browser workspace plus an experimental native Android WireGuard client under `android/`.

## Native Android WireGuard client

The Android app imports one user-selected WireGuard configuration, validates it, encrypts it at rest with Android Keystore-backed AES-GCM, and requests Android VPN consent before activating a tunnel. It displays the profile's interface addresses, DNS, peer endpoints, and each peer's `AllowedIPs`, then reports live RX/TX counters while the app is open. Secret keys are not included in the summary.

A WireGuard configuration may contain multiple peers, but this client does not provision peer devices, discover peers, generate a mesh, or configure gateway forwarding. For a real private mesh, configure each authorized node's own keys and endpoint, reciprocal peer entries, non-overlapping overlay addresses and `AllowedIPs`, plus IP forwarding/firewall rules on any gateway. Those operations are device- and network-administrator responsibilities. Check routes and DNS carefully before connecting. Disconnect remains user-controlled. No proxy client, endpoint rotation, relay mesh, stealth, or firmware modification is implemented. This is an experimental client, not an audited security product.

### Build APK in Termux

The existing Termux checkout can be updated and built using the native AAPT2 helper:

```sh
cd ~/trmux-local-workbench
git pull --ff-only
./android/build-termux.sh
cp android/app/build/outputs/apk/debug/app-debug.apk "$HOME/storage/downloads/"
```

Open the APK from Downloads and confirm Android's installer. This app version increases the package version code to 2. Updates require the same package ID (`org.trmux.app`), signing key, and a higher version code; Android's installer controls the update and restarts the app. Preserve the Termux user's `~/.android/debug.keystore` for local debug updates. Do not mix APKs signed with different keys.

Prerequisites are OpenJDK 21, Gradle, native Termux `aapt2`, and Android SDK platform 35/build-tools 34.0.0. If needed:

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

## Browser workbench and Termux

Requires Node.js 18+:

```sh
git clone https://github.com/foregauto-cloud/trmux-local-workbench.git
cd trmux-local-workbench
npm start
```

Open http://127.0.0.1:3000. The browser workspace is loopback-only, does not execute code or shell commands, and its VPN/proxy screen stores draft details only; it cannot activate a VPN. Optional assistant requests go only to a preinstalled model on local Ollama. This project cannot control device firmware or bypass Android permissions.
