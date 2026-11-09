# Trmux Local Workbench

Local-first coding workbench with a browser editor, defensive log triage, VPN/proxy profile drafts, and an optional chat interface backed by a model installed in local Ollama.

## Run

Requires Node.js 18+:

```sh
npm start
```

Open http://127.0.0.1:3000. The server binds to loopback. Workspace files are read and written in the configured local workspace directory. The chat assistant talks to Ollama at `127.0.0.1:11434`; it does not use a hosted LLM. Install and start Ollama and pull a model before chatting, then use **Refresh** in the assistant panel. Optionally select “Include current open file as context” before sending. Chat messages are sent only to that local Ollama service; treat workspace text as sensitive on the local machine as usual.

The UI is a workspace, not a general operating system: it does not execute shell commands, manage arbitrary apps, or change host network settings. The browser network page saves draft endpoint details only. Actual VPN connections require the native Android WireGuard app and an authorized profile. Analyzer output is heuristic and requires human review.

## Android

See `android/` for the experimental native WireGuard client and Termux build helper. It can connect to peers/routes contained in a user-imported profile after explicit Android VPN consent; it does not create or provision a mesh.
