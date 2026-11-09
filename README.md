# Trmux Android Workbench

The Android APK combines the native WireGuard client with native workbench tools: a local document editor, defensive log indicator review, and optional chat with Ollama listening on this same device. The workbench does not wrap or launch a browser app, and does not execute shell commands or modify files without the Android document picker. VPN configuration is separate and always subject to Android's VPN consent dialog.

## Build and install in Termux

```sh
cd ~/trmux-local-workbench
git pull --ff-only
./android/build-termux.sh
cp android/app/build/outputs/apk/debug/app-debug.apk "$HOME/storage/downloads/"
```

Open the APK from Downloads and confirm Android's installer. This is version 0.4.0 (version code 4); updating requires the same package and signing key. Keep the same Termux user's debug keystore.

## App features and boundaries

- **VPN:** Import a WireGuard profile you are authorized to use. The VPN screen shows configured peers/routes and traffic counters. It is not a mesh coordinator and cannot configure forwarding on remote devices.
- **Editor:** Open and save text files through Android's Storage Access Framework. Files are not automatically uploaded or run.
- **Log review:** Heuristics are local, bounded, and not a substitute for incident response.
- **Local AI:** Install/start Ollama on the same Android device, make it listen on `127.0.0.1:11434`, then use Find local models. Cleartext networking is denied generally and allowed only to loopback for this local Ollama connection. No hosted LLM fallback exists.

The app has not been built or device-tested in this change. Verify the Gradle build, document picker, Ollama requests, VPN approval/denial, and actual routes/DNS on a test device before relying on it.
