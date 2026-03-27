# Contributing to CodeForge

## Read This First

We are not actively accepting contributions right now.

You can still open an issue or PR, but there is a high chance we close it, defer it, or never look at it. This project is early and we are keeping scope, quality, and direction under tight control.

## Trust & Labeling

PRs are automatically labeled with:

- **`vouch:*`** — trust status. External contributors start as `vouch:unvouched` until explicitly added to [.github/VOUCHED.td](.github/VOUCHED.td).
- **`size:*`** — diff size based on changed lines.

## What We Will Consider

- Small, focused bug fixes
- Small reliability or performance improvements
- Tightly scoped maintenance work that clearly improves the project without changing its direction

## What We Will Not Consider

- Large PRs
- Drive-by feature work
- Opinionated rewrites
- Anything that expands product scope without us asking for it first

If you open a 1,000+ line PR full of new features, we will close it.

## PR Guidelines

If you still want to open a PR:

1. **Keep it small.** Do not mix unrelated fixes together.
2. **Explain what changed** and **why the change should exist.**
3. **Include screenshots** (before/after) for any UI change.
4. **Include a short video** if the change involves motion, timing, transitions, or interaction details.

If we have to guess what changed, we are much less likely to review it.

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.3.9+
- [Codex CLI](https://github.com/openai/codex) installed and authorized

### Setup

```bash
bun install
```

### Development Server

```bash
bun dev
```

### Quality Checks

All of these must pass before submitting a PR:

```bash
bun fmt       # Format code (oxfmt)
bun lint      # Lint code (oxlint)
bun typecheck # Type-check (TypeScript)
bun run test  # Run tests (Vitest)
```

## Issues First

If you are thinking about a non-trivial change, open an issue first. That does not mean we will want the PR, but it gives you a chance to avoid wasting your time.

## Expectations

Opening a PR does not create an obligation on our side. We may close it, ignore it, ask you to shrink it, or reimplement the idea ourselves later.

If you are fine with that, proceed.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
