# Trmux Local Workbench

A public, dependency-light, local-first starter for a coding workspace and defensive assistant. It is a web app served on loopback and works from a desktop browser or Termux browser. It is **not** a VS Code replica, Android kernel, VPN, proxy mesh, or certified security product.

## Quick start

Requires Node.js 18+.

```sh
git clone https://github.com/foregauto-cloud/trmux-local-workbench.git
cd trmux-local-workbench
npm start
```

Open http://127.0.0.1:3000. No npm dependencies, account, API key, or sign-in are required to use the editor and log triage. The default workspace is `./workspace`; set `TRMUX_WORKSPACE=/absolute/path` to use another directory. The server is bound to `127.0.0.1` only. Keep the terminal open; Ctrl+C stops it.

### Termux

```sh
pkg update
pkg install nodejs git
git clone https://github.com/foregauto-cloud/trmux-local-workbench.git
cd trmux-local-workbench
npm start
```

Open the same loopback URL in Android browser. This is a Termux-hosted web app, not an APK. Local model runtime support on Android varies; the editor and log triage work without it.

## Included capabilities

- Three-panel coding workspace with file explorer, text editor, save, and responsive browser layout.
- Files are read/written only under the configured workspace. Hidden paths, parent traversal, symlinks, excluded dependency/build folders, and files over 1 MiB are rejected. **Code is never executed**; the output pane is informational, not a shell.
- Optional local assistant connects only to Ollama at `127.0.0.1:11434`, checks that the chosen model is already installed, and has no cloud fallback. Install Ollama/model separately where supported.
- Heuristic defensive log triage runs in memory and doesn’t store submitted text. Findings are indicators, not a verdict.
- No sign-in, telemetry upload, remote control plane, VPN/proxy/mesh, background daemon, or privilege escalation.

## Safety and scope

Do not expose the server to a LAN or the public internet. This is an early scaffold, not a VS Code replacement, autonomous coding agent, operating system, or “12-dimensional” security platform. It does not execute agent tool calls, shell commands, extensions, or generated code. VPN/proxy mesh and Android system integration are deliberately not included. Do not paste secrets into a local model unless you trust the model/runtime and device.

## Configuration

- `PORT` changes the local HTTP port (default `3000`).
- `TRMUX_WORKSPACE` changes the editable workspace root.
- `npm test` runs the built-in Node test suite.
