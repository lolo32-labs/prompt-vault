# 🎯 Prompt Vault — Product-Market Fit Analysis

**Date:** Aug 31, 2026 · **Purpose:** Decide — persevere, pivot, or fold.
**Method:** Desk research across the prompt/skills market (sources at bottom) + segment-by-segment willingness-to-pay analysis. **No vanity framing.**

---

## 1. The blunt answer

**As currently built (browser app, IndexedDB storage, no accounts), no segment pays for Prompt Vault.**

| Segment | Their actual need | Pays for the current vault? | Why |
|---|---|---|---|
| Agent-skills devs (Claude Code, Codex, Cursor) | Skills as **files in git** (`.claude/skills/`, `.github/prompts/`). The ecosystem's own default advice: "prompts are code — use git." | ❌ $0 | Wrong storage substrate. A web vault doesn't fit a file/git pipeline. This is not a feature gap; it's an architecture mismatch. |
| Prompt hobbyists | Anything free | ❌ $0 | Saturated commodity. Free alternatives everywhere (Promta, AIPRM free tier, FlowGPT, a Photoshop plugin literally named "Prompt Vault", promptvault.de…). |
| Teams / enterprise | Prompt **lifecycle**: evals, deployment, observability, governance | ❌ $0 | They buy $49–$2,500/mo lifecycle platforms (PromptLayer, Langfuse, Braintrust). Funded competitors; Humanloop was just absorbed by **Anthropic** — platform consolidation squeezes indies. Current product has zero team surface. |
| Skill creators | Distribution, payments, security scanning | ❌ $0 | They need a marketplace (Agensi et al. take 20–30% for it), not a vault. |

**Implication:** any monetization bolted onto the current product sells into segments with zero demonstrated willingness to pay. This includes the earlier "wrap it in a desktop app, charge $39" idea — discard it.

---

## 2. Market context (what the research says)

- AI prompt marketplace ≈ **$2.5B in 2026**, ~29% CAGR to 2030 (multiple market reports).
- **PromptBase**: 260k+ listings, $1.99–$9.99/prompt, 20% take rate. Top sellers $500–8k/mo — **median listing ≪ $50/mo**. Lesson: marketplaces concentrate income; don't build one.
- **SKILL.md is an open standard** (Anthropic, Dec 2025) adopted by 16–20+ agents (Claude Code, Codex, Cursor, Gemini CLI, OpenClaw). A creator economy is forming around it: **Agensi** (curated marketplace, 30% fee, Stripe Connect, skills $5–25, security scanning), SkillsMP, Skills4Agents, VoltAgent (open directory).
- **What sells as skills:** framework-specific workflows, security/OWASP review, DevOps automation, team conventions. **What doesn't:** generic prompt wrappers.
- **Top ecosystem pains** (from security guides & creator reports): skill **supply-chain trust**, **update drift** as models change, **team/private conventions**.
- **Prompts-as-code tooling already exists but is early/small:** `prompt-ctl` (CLI versioning/testing), `skm` skills manager (~129★), PromptHub (SaaS Git-style), Promptfoo (OSS eval CLI). None own "security-vetted, org-ready skill management, local-first."

Sources: agensi.io guides, hubpy.io PromptBase guide, humai.blog prompt-library economics, braintrust.dev tool comparison, getmaxim.ai platform reviews, costbench pricing pages, GitHub repos (prompt-ctl, nnnggel/skills-management), baeseokjae.github.io agent-skills marketplace guide. Retrieved Aug 31, 2026.

---

## 3. The signal worth extracting

The highest-intent audience is the **skills-economy developer**. Their pains are *not storage*:

1. **Trust & safety** — can I install this skill without it reading my files/exfiltrating? Marketplaces charge 30% largely to do this vetting.
2. **Updates & drift** — skills go stale as models change; there is no good `outdated` story.
3. **Team conventions** — orgs want private, vetted skill sets. They already pay for private npm registries ($7/user/mo shapes).

---

## 4. Options, scored

| Option | Verdict | Notes |
|---|---|---|
| **A. Pivot: "npm for agent skills"** — CLI + thin site. Install / audit / update skills from GitHub; private vetted registries for teams (paid). | **Strongest pivot.** | Reuses built assets: scanner→installer, **watched-repos→`outdated` alerts**, **quality scoring→trust signal**, **registry→curated index**, **encrypted bundles→paid skills**. Differentiated on trust + local-first vs. marketplaces. Risk: crowded-adjacent space, unproven demand for paid tier. |
| **B. Persevere as free portfolio piece** | **Legitimate.** | 83 tests, fail-closed security bridge, real diff engine, deployed product. Worth more at $0 as engineering credibility + consulting/job lead-gen than as a failed product. |
| **C. Team prompt lifecycle (LLMOps)** | ❌ No. | Funded rivals + platform absorption. Wrong fight for a solo builder. |
| **D. Hibernate / archive** | Acceptable fallback. | |
| ~~Pro desktop license on current vault~~ | ❌ Discard. | Charges a segment with no willingness to pay. |
| ~~Marketplace take-rate~~ | ❌ Discard. | Requires becoming the middleman; dominated. |

**Rebrand note:** "Prompt Vault" is taken by 4+ products. Pivot A is the clean moment to rename.

---

## 5. Validation before writing new code (~2 weeks, ~$0)

### 5.1 Interviews — 10 conversations with Claude Code / Codex / Cursor users

Find them: Discord/Slack communities, X, colleagues, r/ClaudeAI posters. 20 minutes each. **Do not pitch. Ask about past behavior, not hypotheticals.**

**Script:**

1. Walk me through the last time you installed or wrote a skill/prompt for your agent. Where does it live right now?
2. How many skills/prompts do you have? Across how many machines or projects?
3. Tell me about the last one that broke or went stale. What did you do?
4. How do you decide whether a skill from GitHub is safe to install? Have you ever read all of its files? Ever found something sketchy?
5. Has a skill ever done something you didn't expect? What happened?
6. How does your team (if any) share prompts/skills? What's the sync story?
7. What dev tools have you paid for in the last year? Roughly how much?
8. If you could wave a wand over one part of this workflow, what would it be?
9. Who do you think should solve this — tool vendors, the agent platforms, nobody?
10. *(Only if a pain emerged)* If a tool solved exactly that, what would you expect to pay, honestly?

**Scoring sheet per interview:**

| Signal | Weight |
|---|---|
| Names trust / updates / team-sharing **unprompted** (Q4–Q6, Q8) | 2 pts each, max 4 |
| Has a story of a skill breaking/exfiltrating (Q3/Q5) | 1 pt |
| Pays for ≥2 dev tools today (Q7) | 1 pt |
| Manages skills across ≥2 machines/projects (Q2) | 1 pt |

**Threshold:** ≥40% of interviews score ≥4 pts → the pain is real and shared → proceed to smoke test. Below that → Option B.

### 5.2 Smoke test — landing page for Pivot A

Post to HN ("Show HN" the current vault + "Ask HN" framing), r/ClaudeAI, r/LocalLLaMA, X. Drive traffic to:

> **Headline:** `npm install` — for agent skills.
> **Subhead:** Install, audit, and update Claude Code / Codex / Cursor skills with confidence. Every skill scored, every dependency visible, every update tracked — locally, no accounts.
> **Bullets:**
> - 🔍 Install any GitHub skill with a one-line command — files land where your agent expects them
> - 🛡️ Every skill gets a deterministic trust score before you run it — dependencies and scripts surfaced, nothing hidden
> - 🔄 `skills outdated` — know when a model update broke your skills, diff what changed upstream
> - 🏢 Team tier: a private, vetted registry of your organization's skills with review workflows
> **CTA:** email capture — "Get early access. Free for individuals, always."

**Threshold:** ≥100 emails with zero ad spend = real pull → build the CLI spike. <30 → the pain isn't commercial → Option B.

### 5.3 If thresholds pass — 2-week CLI spike

`skills install <github-url>` · `skills list` · `skills outdated` · `skills audit <name>` (runs the quality/trust scorer) · `skills diff` (your diff engine). Reuse `src/lib/scanner.ts`, `watch.ts`, `quality.ts`, `diff.ts` almost verbatim — they're pure, tested TypeScript with zero DOM dependencies except `utils.ts` clipboard/UA helpers.

---

## 6. Decision framework

```
Interviews ≥40% high-score?
├─ No  ──→ Option B: keep free, add GitHub Sponsors, move on. Zero regret.
└─ Yes ──→ Landing page live?
           ├─ ≥100 emails ──→ PIVOT A: build CLI spike (2 wks), then decide open-core boundary.
           └─ <30 emails  ──→ Option B (pain real but not commercial).
```

**Either way, do this week regardless:**
- Add GitHub Sponsors to the repo.
- Decide the brand question if pivoting (new name; "Prompt Vault" is crowded).
- Keep the current app deployed and working — it's the demo, the portfolio piece, and the trust-builder for whatever comes next.

---

## 7. What we are NOT doing (and why)

- **Marketplace take-rate** — dominated by PromptBase/Agensi; requires being the middleman the local-first story rejects.
- **LLMOps / team prompt lifecycle SaaS** — funded competitors + Anthropic absorbing Humanloop signals platform consolidation.
- **Paid wrapper of the current vault** — no WTP in segment; would burn community goodwill for nothing.
