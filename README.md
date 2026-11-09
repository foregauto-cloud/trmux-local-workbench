# Trmux Local Workbench

A public, dependency-light, local-first coding workspace and defensive assistant for desktop browsers and Termux. It is an early scaffold, not an operating system, VS Code replacement, or certified security product.

## Quick start

Requires Node.js 18+.

```sh
git clone https://github.com/foregauto-cloud/trmux-local-workbench.git
cd trmux-local-workbench
npm start
```

Open http://127.0.0.1:3000. No account or API key is needed for editor, profile drafts, or log triage. The default workspace is `./workspace`; set `TRMUX_WORKSPACE=/absolute/path` to change it. The server binds to loopback only.

## VPN / proxy profile configurator

The **VPN / proxy profiles** screen has been wired into the main navigation and styled. It saves non-secret endpoint drafts for WireGuard, OpenVPN, SOCKS5, and HTTP CONNECT in this browser's local storage; import/export is JSON. It can also export a *draft template* for a native client. The template is incomplete and contains placeholders; it is not a working VPN profile. No passwords, keys, or certificates are collected or exported.

This is not a VPN/proxy client: it does not connect, tunnel, route traffic, rotate endpoints, change system settings, or establish a mesh. Use the appropriate trusted native client to configure and activate a VPN. Browser apps cannot grant themselves Android VpnService or desktop network privileges. A SOCKS/HTTP endpoint saved here does not automatically proxy Trmux or other apps.

## Workspace and assistant

- Browser editor and file explorer read/write only beneath the configured workspace. Hidden paths, parent traversal, symlinks, excluded folders, and files over 1 MiB are rejected.
- The output panel is informational: no shell or code execution is implemented.
- Optional assistant connects only to a model already installed in Ollama at `127.0.0.1:11434`; no cloud fallback or sign-in.
- Log triage uses simple heuristics in memory. Findings are indicators, not a verdict; submitted log text is not retained.

Termux installs Node.js with `pkg install nodejs git`, clones the public repository, then runs `npm start`; open the loopback URL in an Android browser. This is a Termux-hosted web app, not an APK. Do not expose it beyond loopback.
