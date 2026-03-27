# CodeForge

CodeForge is a minimal web GUI for coding agents (currently Codex and Claude, more coming soon).

## Getting Started

> [!WARNING]
> You need to have [Codex CLI](https://github.com/openai/codex) installed and authorized for CodeForge to work.

### Desktop App (Recommended)

Install the [desktop app from the Releases page](https://github.com/pingdotgg/codeforge/releases).

### CLI

```bash
npx codeforge
```

## Architecture

CodeForge is a Bun-based monorepo managed with [Turbo](https://turbo.build/).

| Package              | Description                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server`        | Node.js WebSocket server. Wraps the Codex app-server (JSON-RPC over stdio), serves the React web app, and manages provider sessions.                    |
| `apps/web`           | React/Vite UI. Owns session UX, conversation/event rendering, and client-side state. Connects to the server via WebSocket.                              |
| `apps/desktop`       | Electron-based desktop application wrapping the web and server apps.                                                                                    |
| `packages/contracts` | Shared Effect/Schema schemas and TypeScript contracts for provider events, WebSocket protocol, and model/session types. Schema-only — no runtime logic. |
| `packages/shared`    | Shared runtime utilities consumed by both server and web. Uses explicit subpath exports (e.g. `@codeforge/shared/git`).                                 |

### Tech Stack

- **Runtime**: Bun, Node.js
- **Language**: TypeScript (ESM)
- **Frontend**: React 19, Vite, Tailwind CSS, Zustand
- **Backend**: Effect.TS, WebSockets, node-pty
- **Build**: Turbo, tsdown
- **Testing**: Vitest, Playwright
- **Linting**: oxlint, oxfmt

## Status

We are very early in this project. Expect bugs.

## Contributing

We are not accepting contributions yet. If you _really_ want to contribute, read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).

## License

[MIT](./LICENSE)
