# Trmux Android Workbench

The Android APK combines a native WireGuard client with native workbench tools: a local document editor, defensive log indicator review, and optional chat with Ollama listening on this same device. The workbench does not wrap or launch a browser app, and does not execute shell commands or modify files without the Android document picker. VPN configuration is separate and always subject to Android's VPN consent dialog.

## Build and install in Termux

```sh
cd ~/trmux-local-workbench
git pull --ff-only
./android/build-termux.sh
cp android/app/build/outputs/apk/debug/app-debug.apk "$HOME/storage/downloads/"
```

Open the APK from Downloads and confirm Android's installer. This release is version 0.5.0 (version code 5); updating requires the same package and signing key. Keep the same Termux user's debug keystore.

## App features and boundaries

- **VPN:** Import a WireGuard profile you are authorized to use. Android presents VPN consent before connecting. The app shows profile routes and DNS; it is not a mesh coordinator and cannot configure forwarding on remote devices.
- **Editor:** Open and save text files through Android's Storage Access Framework. File content is bounded to 1 MiB and is not automatically uploaded or run.
- **Log review:** Heuristics are local, bounded, and not a substitute for incident response.
- **Local AI:** Install/start Ollama on this same device and use Find local models. Requests use fixed loopback address `127.0.0.1:11434`, redirects are disabled, connect/read timeouts and response size bounds are enforced, and there is no hosted LLM fallback. Android cleartext is denied except loopback/localhost for this local Ollama protocol. Never configure a remote Ollama host in this client.

The APK is not built or device-tested by this source update. Verify Gradle compilation, document picker behavior, local Ollama protocol, VPN approval/denial, and actual routes/DNS on a test device before relying on it.
