<p align="center">
  <img src="design-assets/Logo.png" alt="CodeForge" width="128" />
</p>

<h1 align="center">CodeForge</h1>

<p align="center">
  A web GUI for coding agents. Use Codex and Claude from one interface.
</p>

<p align="center">
  <a href="https://github.com/Kuka123456789/codeforge/releases">Download</a> · <a href="https://discord.gg/jn4EGJjrvv">Discord</a> · <a href="./CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="apps/marketing/public/screenshot.jpeg" alt="CodeForge screenshot" width="720" />
</p>

---

## What Is This

CodeForge gives you a single UI for working with AI coding agents. Point it at a project, pick a provider (Codex or Claude), and start a conversation. The agent can read your code, propose changes, run commands, and create commits — all with your approval.

**Key capabilities:**

- **Multi-provider** — Switch between Codex (via CLI) and Claude (via Agent SDK) per conversation
- **Approval workflow** — Review and approve file changes and commands before they run, or grant full access
- **Built-in terminal** — Run commands directly from the chat interface
- **Git-native** — Branch management, diffs, commits, and PR creation without leaving the app
- **Checkpointing** — Save and resume sessions from any point
- **Desktop + CLI** — Run as an Electron app or via `npx codeforge`

## Install

### Desktop App (Recommended)

Download from the [Releases page](https://github.com/Kuka123456789/codeforge/releases).

### CLI

```bash
npx codeforge
```

### Prerequisites

- [Codex CLI](https://github.com/openai/codex) installed and authorized (required for Codex provider)
- An Anthropic API key (required for Claude provider)

## Architecture

Bun monorepo managed with [Turbo](https://turbo.build/).

| Package              | Role                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `apps/server`        | Node.js WebSocket server. Wraps Codex app-server (JSON-RPC over stdio), manages Claude Agent SDK sessions, serves the web app. |
| `apps/web`           | React/Vite frontend. Session UX, conversation rendering, client-side state. Connects to server via WebSocket.                  |
| `apps/desktop`       | Electron shell wrapping the web and server apps.                                                                               |
| `packages/contracts` | Shared Effect/Schema definitions. TypeScript contracts for events, protocol, and types. Schema-only — no runtime logic.        |
| `packages/shared`    | Shared runtime utilities. Explicit subpath exports (`@codeforge/shared/git`, etc.).                                            |

### Tech Stack

| Layer    | Technology                                                         |
| -------- | ------------------------------------------------------------------ |
| Runtime  | Bun, Node.js                                                       |
| Language | TypeScript (ESM, strict)                                           |
| Frontend | React 19, Vite 8, Tailwind CSS 4, Zustand, TanStack Router + Query |
| Backend  | Effect.TS, WebSockets, node-pty, SQLite                            |
| Desktop  | Electron                                                           |
| Build    | Turbo, tsdown                                                      |
| Testing  | Vitest, Playwright                                                 |
| Linting  | oxlint, oxfmt                                                      |

### How It Works

1. **Server starts** a WebSocket server on localhost
2. **Frontend connects** and establishes a persistent WS channel
3. **User sends a message** — routed to the selected provider (Codex CLI via JSON-RPC or Claude via Agent SDK)
4. **Provider responds** with text, file changes, or command requests — streamed to the UI
5. **User approves or declines** proposed changes (or uses full-access mode)
6. **State is event-sourced** — all changes are tracked as immutable domain events, persisted to SQLite

## Development

```bash
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
