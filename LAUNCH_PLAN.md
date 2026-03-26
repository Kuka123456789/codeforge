# CodeForge Launch Plan

## Before Launch: Fix What's Broken

These must be done before the landing page goes live or any promotion happens.

### Landing Page TODOs
- [ ] **Replace screenshot placeholder** — Take an actual screenshot of CodeForge or record a short demo video (60s max). This is the single highest-impact item.
- [ ] **Wire up email signup** — The form currently logs to console. Options: Formspree (free tier), Google Forms, or a simple serverless function. Pick one and connect it.
- [ ] **Replace GitHub URLs** — All links currently point to `YOUR_USERNAME/codeforge`. Update with the real repo URL (or remove GitHub links if keeping the repo private for now).
- [ ] **Replace contact email** — Footer links to `hello@codeforge.dev`. Set up a real email or change to your actual address.
- [ ] **Deploy the landing page** — Host on Vercel, Netlify, or GitHub Pages. Get a custom domain if possible.

### Product TODOs (pre-launch blockers)
- [ ] **Decide on license** — Currently MIT in the repo, but you flagged this needs work. Options: MIT (most permissive, good for adoption), AGPL (prevents SaaS competitors from using your code without contributing back), BSL/SSPL (source-available but not OSS). The landing page currently says "open source" generically — update once decided.
- [ ] **Publish an npm package under CodeForge's name** — Currently the npm package is `t3` (upstream T3 Code). CodeForge needs its own package so users can run something like `npx codeforge`. Until then, the install story is "download the desktop app" or "clone + bun dev".
- [ ] **Verify fresh install works** — Test `git clone && bun install && bun dev` from a clean machine. Does it require Codex/Claude CLI pre-installed? Document any prerequisites clearly.
- [ ] **Write a README** — The repo needs a clear README with: what CodeForge is, how to install, how to connect providers, screenshots. This is what people see first on GitHub.

### Product TODOs (important but not blocking launch)
- [ ] **Docker support** — Many self-hosted users expect Docker. Create a Dockerfile and `docker-compose.yml`. This would expand the audience significantly.
- [ ] **Clarify the T3 Code relationship** — CodeForge is forked from T3 Code. Decide how to communicate this: "Built on T3 Code", "Fork of T3 Code", or don't mention it. Check T3 Code's license to ensure the fork and rebrand are compliant.

---

## Phase 1: Validate Demand (Week 1)

- [ ] **Complete landing page TODOs above**
- [ ] **Record a demo** — 60-second screen recording: open CodeForge, start a session, ask Claude to write some code, show the result. Keep it real, don't over-produce.
- [ ] **Deploy the landing page** — Live on a real URL.

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

1. **Claude support** — T3 Code is Codex-only. CodeForge supports Claude (Opus, Sonnet, Haiku) with full reasoning effort levels and ultrathink.
2. **Multi-provider** — Switch between Claude and Codex freely. Each provider remembers its model selection.
3. **Customizable keybindings** — Full keybinding system via `~/.t3/keybindings.json`.
4. **Multi-terminal** — Split terminals, multiple terminal sessions (Mod+D, Mod+N, Mod+W).
5. **UX polish** — Escape to stop generation, resizable sidebar, edit & resend messages, context window usage display, word wrap toggle for diffs, scroll-to-bottom pill, sorted threads by recency.
6. **Desktop app** — Electron-based with auto-updates.
