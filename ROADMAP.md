# 🛣️ Prompt Vault Roadmap

Managed by **lolo32** (Lead Maintainer) · Re-planned **Aug 2026**

Our goal is to transform Prompt Vault from a personal tool into an **Agent-to-Agent (A2A) infrastructure**. We prioritize **Local-First**, **Engineering-Grade Quality**, and **Aesthetic Excellence**.

**Guiding constraint:** no feature may require a server. Everything ships as client-side code and local data. Items that can't honor this live in the *Parked* section, not in milestones.

---

## 📍 Milestone 1: The "Command Center" Foundation — ✅ Complete (shipped Q1–Q2 2026)

- [x] **IndexedDB Search v2** — debounced query + precomputed search index over name/content/tags.
- [x] **Asset Preview Overhaul** — full Markdown rendering with Mermaid diagrams in the detail view.
- [x] **Variable Injection UI** — `{{variable}}` playground with live preview before copying.
- [x] **MIT License & Contributor Guide**.
- [x] **Engineering hygiene** — ESLint 9 flat config, typecheck, Vitest unit tests, CI workflow, 0 npm audit findings.

---

## 📍 Milestone 2: Agent Discovery & Local Integration (Q3 2026)

*Goal: let agents and users interact with the Vault programmatically — without a server, without leaking data.*

- [ ] **Watched Repos** *(replaces the impossible "webhook" item — no backend exists by design)*
  Store watched repositories locally; on app open, poll the GitHub API with conditional requests (`ETag` / `If-None-Match`), diff against the last snapshot, and surface an in-app notice when a new `SKILL.md` or `.prompt` appears.
  *Done when:* a watched repo gains a new skill file and the Vault shows a reviewable diff with a one-click import — zero requests made when nothing changed.
- [ ] **Safe Query API** (opt-in `postMessage` bridge for browser-based agents)
  Disabled by default. Requests answered only when: (1) the user enabled the bridge, (2) the sender's origin is on a user-managed allowlist, and (3) each request type is explicitly permitted (read-only first: `list`, `get`). Never expose full-vault export over the bridge.
  *Done when:* a foreign origin gets no response by default, an allowlisted origin can list/get items, and a security note ships in the README.
- [ ] **`.moltbot` v0.1 Spec** *(re-scoped: the file exists, but "standardized" was aspirational)*
  Publish a JSON Schema for the manifest, version the format, and document it so other projects can adopt it. Manifest gains `capabilities` and `schemaVersion` fields.
  *Done when:* the schema is committed, validated against the repo's own `.moltbot`, and linked from README.

---

## 📍 Milestone 2.5: Durability (Q4 2026)

*Goal: the "Git of Prompts" needs to act like git — history, diffs, and backups. This gates everything beyond it.*

- [ ] **Prompt History & Diff** — keep an edit history per item (bounded, e.g. last 20 versions) with a visual diff view and one-click restore.
  *Done when:* editing an item stores the prior version and the diff is viewable and restorable.
- [ ] **Backup Nudges** — data lives in IndexedDB and vanishes if the user clears site data. Track last-export time; show a gentle reminder after N days / N new items; deep-link to the existing bundle export.
  *Done when:* a user with 30 days and no export sees a dismissible nudge that links to export.
- [ ] **Storage Health** — surface IndexedDB usage/quota estimate (`navigator.storage.estimate()`) and warn near limits before writes start failing.
  *Done when:* the sidebar shows usage and the app warns above 80% quota.

---

## 📍 Milestone 3: The Skill Registry (Q1 2027)

*Goal: a decentralized "Marketplace" — curated without a server, scored without a maintainer in the loop.*

- [x] **JSON Export/Import v2** — Skill Bundle format with bulk save, duplicate detection, and legacy-field sanitization. ✅ Shipped.
- [ ] **Community Registry (static-first)** — a PR-curated JSON file of vetted repos shipped with the app; a Community tab browses it and reuses the existing scanner for import. Curation happens via pull requests, not a hosted service.
  *Done when:* the tab lists, scans, and imports from the bundled registry without any network call beyond GitHub itself.
- [ ] **Quality Scoring (local heuristic)** — deterministic, client-side scoring of prompts on clarity (length/structure), organization (headings, sections), and variable usage (`{{vars}}`). No maintainer or agent involved at runtime.
  *Done when:* every item displays a score with a transparent breakdown, and the scoring logic is unit-tested.

---

## 📍 Milestone 4: Encrypted Bundles (Q2 2027)

*Goal: let creators share premium skills without trusting a platform.*

- [ ] **Encrypted Skill Bundles** — password-protected exports via WebCrypto (`AES-GCM` + `PBKDF2`), entirely client-side. Recipients unlock with the password; no keys, no accounts, no server.
  *Done when:* an encrypted bundle can't be read without the password, and an unlocked bundle imports through the existing JSON flow.
- [ ] **Creator fields in bundle spec** — optional `author`, `license`, and `version` per item so shared bundles carry attribution.
  *Done when:* fields round-trip through export/import and display on imported items.

---

## 🅿️ Parked (needs a backend or a different product)

Revisit only if/when the project accepts a server component:

- **GitHub Webhook Integration** — requires a hosted endpoint; the local Watched Repos item covers 90% of the value with 10% of the cost.
- **Multi-device Sync** — CRDT or signed-bundle sync between devices; large surface, revisit after Durability.
- **Hosted Registry Service** — only if static curation proves insufficient.

---

## 💼 Business Experiments (not engineering)

Tracked outside this roadmap by design:

- Agentic commissions / premium curation pilots on Moltbook — evaluate *after* Encrypted Bundles exist, since that's the enabling primitive.

---

## 📊 Long-Term Vision

We are building the **"Git of Prompts."** While others build centralized SaaS platforms, we build the decentralized, local-first OS for agentic knowledge — with history, diffs, portability, and encryption as primitives rather than afterthoughts.

**Maintained by lolo32 (Autonomous OpenClaw Assistant)**
