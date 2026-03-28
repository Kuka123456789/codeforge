<p align="center">
  <img src="design-assets/Logo.png" alt="CodeForge" width="128" />
</p>

<h1 align="center">CodeForge</h1>

<p align="center">
  A self-hosted web UI for AI coding agents. Run it on your server, use your own API keys, access it from any browser.
</p>

<p align="center">
  <a href="https://codeforge.chat">Website</a> · <a href="https://github.com/Kuka123456789/codeforge/releases">Download</a> · <a href="https://discord.gg/jn4EGJjrvv">Discord</a>
</p>

---

## What Is CodeForge

CodeForge gives you a single interface for working with AI coding agents. Point it at a project, pick a provider (Codex or Claude), and start a conversation. The agent can read your code, propose changes, run commands, and create commits — all with your approval.

Your code stays on your machine. Your API keys stay on your machine. There are no CodeForge servers.

### Key Features

- **Multi-provider** — Switch between Codex (via CLI) and Claude (via Agent SDK) per conversation
- **Native slash commands** — Works across every provider, no lock-in
- **Skills management** — Organize reusable AI skills into a library
- **Conversation management** — Search, archive, rename, and browse prompt history
- **Approval workflow** — Review and approve file changes and commands before they run
- **Built-in terminal** — Run commands directly from the chat interface
- **Git-native** — Branch management, selective file staging, diffs, commits, and PR creation
- **Checkpointing** — Save and resume sessions from any point
- **Private by default** — No telemetry, no analytics, runs entirely on your infrastructure

## Install

### Desktop App

Download from the [Releases page](https://github.com/Kuka123456789/codeforge/releases). Available for macOS, Linux, and Windows.

### CLI

```bash
npx codeforge
```

This starts the server and opens the UI in your browser.

### Prerequisites

| Provider | Requirement |
|----------|-------------|
| **Codex** | [Codex CLI](https://github.com/openai/codex) installed and authenticated |
| **Claude** | `ANTHROPIC_API_KEY` environment variable set |

You only need the provider(s) you plan to use.

## Architecture

Bun monorepo managed with [Turbo](https://turbo.build/).

| Package | Role |
|---------|------|
| `apps/server` | Node.js WebSocket server. Wraps Codex app-server (JSON-RPC over stdio), manages Claude Agent SDK sessions, serves the web app. |
| `apps/web` | React/Vite frontend. Session UX, conversation rendering, client-side state. Connects to server via WebSocket. |
| `apps/desktop` | Electron shell wrapping the web and server apps. |
| `packages/contracts` | Shared Effect/Schema definitions. TypeScript contracts for events, protocol, and types. Schema-only — no runtime logic. |
| `packages/shared` | Shared runtime utilities. Explicit subpath exports (`@codeforge/shared/git`, etc.). |

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun, Node.js |
| Language | TypeScript (ESM, strict) |
| Frontend | React 19, Vite 8, Tailwind CSS 4, Zustand, TanStack Router + Query |
| Backend | Effect.TS, WebSockets, node-pty, SQLite |
| Desktop | Electron |
| Build | Turbo, tsdown |
| Testing | Vitest, Playwright |
| Linting | oxlint, oxfmt |

### How It Works

1. **Server starts** a WebSocket server on localhost (default port 3773)
2. **Frontend connects** and establishes a persistent WS channel
3. **User sends a message** — routed to the selected provider (Codex CLI via JSON-RPC or Claude via Agent SDK)
4. **Provider responds** with text, file changes, or command requests — streamed to the UI
5. **User approves or declines** proposed changes (or uses full-access mode)
6. **State is event-sourced** — all changes are tracked as immutable domain events, persisted to SQLite

## Development

```bash
git clone https://github.com/Kuka123456789/codeforge.git
cd codeforge
bun install
bun dev
```

Quality checks (all must pass before submitting changes):

```bash
bun fmt        # Format (oxfmt)
bun lint       # Lint (oxlint)
bun typecheck  # Type-check (tsc)
bun run test   # Test (Vitest)
```

## Status

Early. Expect bugs. We are iterating fast and breaking things regularly.

## Contributing

We are not accepting contributions yet. If you _really_ want to contribute, read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## License

[MIT](./LICENSE)
