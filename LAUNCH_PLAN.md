# CodeForge Launch Plan

## Before Launch: Fix What's Broken

These must be done before the landing page goes live or any promotion happens.

### Landing Page TODOs

- [x] **Replace screenshot placeholder** — Replaced with a mockup of the CodeForge UI.
- [x] **Wire up email signup** — Connected to FormSubmit.co, emails go to daniel.odesser@gmail.com. Redirects back to codeforge.chat#signup-thanks on success.
- [x] **Replace GitHub URLs** — All links now point to `https://github.com/Kuka123456789/codeforge`.
- [x] **Replace contact email** — Footer now links to `daniel.odesser@gmail.com`.
- [x] **Deploy the landing page** — Live on Vercel at `codeforge.chat`.

### Product TODOs (pre-launch blockers)

- [x] **Decide on license** — MIT. Already in LICENSE with proper attribution to T3 Code / Ping.gg. Landing page says "open source" which is accurate.
- [x] **Publish an npm package under CodeForge's name** — Published as `codeforge-chat` on npm (`npx codeforge-chat`). Name `codeforge` was blocked by npm's typosquatting protection (conflicts with `code-forge`).
- [x] **Verify fresh install works** — Build passes (`bun install && bun run build` succeeds). Prerequisites: Codex CLI for Codex provider, `ANTHROPIC_API_KEY` for Claude provider. Documented in README.
- [x] **Write a README** — Updated with features, install instructions, prerequisites table, architecture, dev setup, and links to codeforge.chat.

### Product TODOs (important but not blocking launch)

- [ ] **Package the desktop app** — Currently the desktop app only runs in dev mode (`bun run dev:desktop`). Need to package it as a proper `.app` / `.dmg` (macOS), `.AppImage` (Linux), and `.exe` installer (Windows) using electron-builder so users can just download and double-click. This is critical for the "download the desktop app" install story.
- [ ] **Fix desktop app icon** — The dock icon shows a white square in dev mode because macOS doesn't load custom icons outside of a packaged `.app` bundle. Packaging (above) fixes this. Also verify the `icon.png` has a transparent background (not white behind the circle).
- [ ] **Docker support** — Many self-hosted users expect Docker. Create a Dockerfile and `docker-compose.yml`. This would expand the audience significantly.
- [ ] **Clarify the T3 Code relationship** — CodeForge is forked from T3 Code. Decide how to communicate this: "Built on T3 Code", "Fork of T3 Code", or don't mention it. Check T3 Code's license to ensure the fork and rebrand are compliant.

---

## Phase 1: Validate Demand (Week 1)

- [x] **Complete landing page TODOs above**
- [ ] **Record a demo** — 60-second screen recording: open CodeForge, start a session, ask Claude to write some code, show the result. Keep it real, don't over-produce.
- [x] **Deploy the landing page** — Live at `codeforge.chat`.

## Phase 2: Get Eyes On It (Week 2-3)

- [ ] **Post on r/selfhosted** — Lead with the local-first angle. "I built an open-source web UI for coding agents that runs on your machine."
- [ ] **Show HN post** — Short, honest. Show the demo. Mention it supports both Claude and Codex.
- [ ] **Twitter/X thread** — Demo video + why you forked T3 Code and what you added (Claude support, multi-provider, UX improvements).
- [ ] **Post in Discord communities** — AI engineering, self-hosted, indie hacker servers.

## Phase 3: Talk to Users (Week 2-4)

- [ ] **Reach out to 5-10 potential users** — Engineers, freelancers, small team leads. Ask: "Would you pay for a polished, multi-provider coding agent UI?"
- [ ] **Collect feedback** — What features matter? What's missing? What would make them pay?

## Phase 4: Decide (Week 4)

- [ ] **Evaluate signal** — How many signups? What did conversations reveal? Is there a paying audience?
- [ ] **If yes** — Build team features (auth, usage tracking, shared sessions, Docker deployment). Consider a hosted tier.
- [ ] **If no** — Pivot the angle based on feedback, or keep it as a strong open-source project.

---

## Key Differentiators vs T3 Code (for messaging)

These are the real features CodeForge adds over upstream T3 Code:

1. **Native slash commands for all providers** — Slash command system that works across Claude, Codex, and any provider. T3 Code has limited support.
2. **Skills management** — Organize and manage reusable AI skills. T3 Code doesn't have this.
3. **Smart chat search** — Search across all conversations. T3 Code doesn't have this.
4. **Prompt history UI** — View and navigate previous prompts with a polished interface. T3 Code has only basic support.
5. **Chat archiving** — Archive old conversations to keep your workspace clean. T3 Code doesn't have this.
6. **Better chat renaming** — Inline clickable rename in the chat header. Faster and more intuitive.
7. **Better git staging UX** — Selective file staging with a polished interface for choosing what goes into commits.
8. **Better UI overall** — Resizable sidebar, escape to stop generation, edit & resend messages, context window usage display, word wrap toggle for diffs, scroll-to-bottom pill, sorted threads by recency, collapsed sidebar previews.

Note: T3 Code now also has multi-provider support, multi-terminal, and likely customizable keybindings. Don't claim these as differentiators.
