# Trmux Local Workbench

The public repository includes a local-first browser workspace plus an experimental native Android WireGuard controller under `android/`.

## Native Android VPN app (WireGuard)

The `android/` subproject is a native Android application, separate from the Termux web app. It imports a user-selected WireGuard configuration, parses it with the official WireGuard tunnel library, encrypts the configuration at rest using Android Keystore-backed AES-GCM, and requests Android's explicit `VpnService.prepare()` consent before connecting. Disconnect is user-controlled. Build with Android Studio or a compatible Gradle installation and Android SDK 35:

```sh
cd android
gradle assembleDebug
```

Install the resulting `android/app/build/outputs/apk/debug/app-debug.apk` on a test device. Review the WireGuard library's license and upstream documentation before distributing. This initial Android project is an experimental minimal controller, not an audited VPN product. Test connect/disconnect and permission-denial behavior on a spare device before using it for sensitive traffic.

Current native support is **WireGuard only**. The web configurator's OpenVPN/SOCKS5/HTTP CONNECT profiles remain drafts and are not active connections. OpenVPN or system-wide proxy support needs separate native implementations. No proxy chaining, endpoint rotation, relay mesh, stealth, or automatic traffic redirection is included. VPN routes and DNS are taken from the imported WireGuard config; inspect them with the provider before approving connection. Android's system VPN consent is required.

## Web workspace and Termux

Requires Node.js 18+:

```sh
git clone https://github.com/foregauto-cloud/trmux-local-workbench.git
cd trmux-local-workbench
npm start
```

Open http://127.0.0.1:3000. No account is needed for editor, local log triage, or browser-only profile drafts. Termux: `pkg install nodejs git`, clone, `cd` into the repository, and run `npm start`; open the loopback URL in an Android browser. The browser app cannot activate a VPN.

The server is loopback-only, does not execute code or shell commands, and its optional assistant calls only a preinstalled model on local Ollama. This repository is a prototype, not an operating system, VS Code replacement, or certified security product.
