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

Termux:

```sh
pkg update
pkg install nodejs git
git clone https://github.com/foregauto-cloud/trmux-local-workbench.git
cd trmux-local-workbench
npm start
```

Open the loopback URL in an Android browser. This is a Termux-hosted web app, not an APK.

## VPN / proxy profile configurator

The **VPN / proxy profiles** screen organizes non-secret endpoint drafts for WireGuard, OpenVPN, SOCKS5, and HTTP CONNECT. Drafts are stored in browser `localStorage` and can be imported/exported as JSON. It intentionally does not collect passwords/private keys, connect to endpoints, change system routing, tunnel traffic, rotate proxies, run a mesh, or configure Android VPN permissions. To activate a VPN/proxy, use a trusted native client and enter credentials there. Browser apps cannot grant themselves Android's `VpnService` or desktop system-network privileges.

## Workspace and assistant

- Browser editor and file explorer read/write only beneath the configured workspace. Hidden paths, parent traversal, symlinks, excluded folders, and files over 1 MiB are rejected.
- The output panel is informational: no shell or code execution is implemented.
- Optional assistant connects only to a model already installed in Ollama at `127.0.0.1:11434`; no cloud fallback or sign-in. Runtime support on Android/Termux is not guaranteed.
- Log triage uses simple heuristics in memory. Findings are indicators, not a verdict; submitted log text is not retained.

This scaffold has no proxy mesh, VPN client, autonomous coding agent, remote control plane, background daemon, or privilege escalation. Do not expose it beyond loopback. Review model outputs before use and do not enter secrets into an untrusted runtime.
