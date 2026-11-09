# Trmux Local Workbench

The public repository includes a local-first browser workspace plus an experimental native Android WireGuard client under `android/`.

## Native Android WireGuard client

The Android app imports one user-selected WireGuard configuration, validates it, encrypts it at rest with Android Keystore-backed AES-GCM, and requests Android VPN consent before activating a tunnel. It displays the profile's interface addresses, DNS, peer endpoints, and each peer's `AllowedIPs`, then reports live RX/TX counters while the app is open. Secret keys are not included in the summary.

A WireGuard configuration may contain multiple peers, but this client does not provision peer devices, discover peers, generate a mesh, or configure gateway forwarding. For a real private mesh, configure each authorized node's own keys and endpoint, reciprocal peer entries, non-overlapping overlay addresses and `AllowedIPs`, plus IP forwarding/firewall rules on any gateway. Those operations are device- and network-administrator responsibilities. Check routes and DNS carefully before connecting. Disconnect remains user-controlled. No proxy client, endpoint rotation, relay mesh, stealth, or firmware modification is implemented. This is an experimental client, not an audited security product.

### Build APK in Termux

```sh
cd ~/trmux-local-workbench
git pull --ff-only
./android/build-termux.sh
cp android/app/build/outputs/apk/debug/app-debug.apk "$HOME/storage/downloads/"
```

Open the APK from Downloads and confirm Android's installer. This app is version 0.3.0 (version code 3); updates require the same package ID (`org.trmux.app`), signing key, and a higher version code. Preserve the Termux user's `~/.android/debug.keystore` for local debug updates. Do not mix APKs signed with different keys. Android displays the VPN permission result separately; this build handles approval even when the system returns no result Intent.

## Browser workbench and Termux

Requires Node.js 18+:

```sh
git clone https://github.com/foregauto-cloud/trmux-local-workbench.git
cd trmux-local-workbench
npm start
```

Open http://127.0.0.1:3000. The browser workspace is loopback-only, does not execute code or shell commands, and its VPN/proxy screen stores draft details only; it cannot activate a VPN. Optional assistant requests go only to a preinstalled model on local Ollama. This project cannot control device firmware or bypass Android permissions.
