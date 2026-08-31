# 📋 Prompt Vault Backlog

Agile backlog derived from [ROADMAP.md](../ROADMAP.md) · Planned **Aug 2026**

**Cadence:** 1 week = 1 sprint (solo dev pace). **Sizes:** S ≤ ½ day · M ≤ 1 day · L ≤ 2 days.

**Definition of Done (every story):** lint + typecheck + tests + build green · unit tests for pure logic · loading/error/empty states handled · no artificial delays · a11y basics (labels, keyboard) · docs updated where user-facing.

---

## 🏃 Sprint plan

| Sprint | Focus | Epics |
|---|---|---|
| 1 | Watched Repos (M2) | A |
| 2 | Agent bridge + manifest (M2) | B, C |
| 3 | Durability (M2.5) | D, E, F |
| 4 | Registry (M3) | G, H |
| 5 | Encrypted bundles (M4) + polish | I, J, K |

---

## 🎯 Epic A — Watched Repos (M2 · replaces webhooks, no server)

**Goal:** user watches GitHub repos; Vault notices new/changed `SKILL.md`/`.prompt` files on open and offers one-click review.

- **A1 (M)** Watch data model + storage CRUD — `watch:<owner/repo>` keys: `{ owner, repo, etag?, lastCheckedAt?, lastError?, snapshotPaths: string[] }`; `addWatch/removeWatch/listWatches/updateSnapshot`.
- **A2 (M)** ETag support in scanner — capture `ETag` from tree response; send `If-None-Match`; treat `304` as "no changes" (zero-cost poll); return changed-tree signal to caller.
- **A3 (M)** Diff logic — compare candidate paths vs snapshot → `{ added, changed, removed }` (changed = path known; content hash compare for changed files); unit tests.
- **A4 (M)** Poll orchestration — check all watches on app open (staggered, abortable), manual "Check now"; back off on 403/rate-limit and record `lastError`.
- **A5 (M)** Watch management UI — from a successful scan: "Watch this repo"; sidebar/import section lists watches with last-checked + status, remove action.
- **A6 (M)** "New skills found" review flow — reuse ImportSelector with `New`/`Changed` badges and pre-checked additions; importing updates the snapshot.
- **A7 (S)** Failure UX — repo gone (404 → mark stale, offer unwatch), offline, rate-limited: clear status per watch; tests for diff + 304 handling (A3/A2).

## 🎯 Epic B — Safe Query API (M2 · opt-in postMessage bridge)

**Goal:** other browser-based agents can read the vault — only with explicit user consent per origin and per action.

- **B1 (S)** Security design doc — `docs/query-api.md`: envelope `{ v, id, action, payload }`, error codes, threat model (why read-only first, why no full export over the bridge).
- **B2 (S)** Settings model + persistence — `{ bridgeEnabled: false, allowedOrigins: [], permissions: { list: false, get: false } }`.
- **B3 (M)** Settings UI — sidebar section or modal: master toggle, add/remove origin, per-action toggles; show a live "listening" indicator when enabled.
- **B4 (M)** Message handler — validate `origin` against allowlist before anything; implement `ping`/`list`/`get` (no mutations); respond only to allowlisted origins; never log payload contents.
- **B5 (S)** Protocol unit tests — foreign origin gets silence, unknown action error, permission-denied error, valid round-trip.

## 🎯 Epic C — `.moltbot` v0.1 Spec (M2)

- **C1 (S)** JSON Schema — `schemaVersion`, `agent`, `project`, `interaction`, `capabilities` (typed, documented).
- **C2 (S)** Migrate repo manifest to v0.1 + CI validation step (schema check via script).
- **C3 (S)** Document the spec in README so other projects can adopt it.

## 🎯 Epic D — Prompt History & Diff (M2.5)

**Goal:** the "Git of Prompts" primitive — edits are reversible.

- **D1 (M)** History model + storage — bounded ring (last 20 versions) per item, stored alongside the item; prune oldest.
- **D2 (S)** Capture-on-write — every successful edit (full editor, rename) pushes the prior version; unit tests for pruning.
- **D3 (M)** Diff rendering — lightweight line-diff util (no heavy dependency) rendering add/remove lines; unit tests.
- **D4 (M)** History UI — tab in detail modal: version list, diff view, one-click restore (restore itself records history).

## 🎯 Epic E — Backup Nudges (M2.5)

- **E1 (S)** Track `lastExportAt` + dismissal state in a storage meta key.
- **E2 (M)** Nudge logic + UI — trigger after 30 days or ≥10 new items since last export; dismissible banner deep-linking to bundle export; silenced 14 days after dismiss; unit tests for trigger rules.

## 🎯 Epic F — Storage Health (M2.5)

- **F1 (S)** `navigator.storage.estimate()` hook + usage meter in sidebar footer.
- **F2 (S)** Pre-write warning at >80% quota; friendly quota-exceeded errors on save (aligns with existing `error.tsx` messaging).

## 🎯 Epic G — Community Registry (M3)

- **G1 (S)** Registry schema + seed file — PR-curated `registry.json` (10 vetted repos incl. `anthropics/skills`) with name, description, tags, repo URL.
- **G2 (M)** Community tab — browse the bundled list; pick a repo → existing scanner → import flow; works fully offline except GitHub fetches.
- **G3 (S)** CI validation — registry entries schema-checked and URL-validated on every PR.

## 🎯 Epic H — Quality Scoring (M3 · local heuristic)

- **H1 (M)** Scoring module — deterministic 0–100 across clarity (concision, structure), organization (headings/sections), variable usage (`{{vars}}`); no network, no LLM; unit tests.
- **H2 (M)** Score UI — badge on cards + breakdown panel in detail modal (transparent criteria, no shaming copy).

## 🎯 Epic I — Encrypted Skill Bundles (M4)

- **I1 (M)** WebCrypto module — `AES-GCM` + `PBKDF2` (high iterations, random salt/IV); encrypt/decrypt JSON payloads; unit tests incl. wrong-password and tamper cases.
- **I2 (M)** Export-with-password flow — produces `.pvault` file with magic header + format version; password never stored.
- **I3 (M)** Import-encrypted flow — password prompt, clear wrong-password/tamper errors; unlocked bundle enters the existing import pipeline.

## 🎯 Epic J — Creator Fields (M4)

- **J1 (S)** Extend `PromptItem` + bundle format with optional `author`, `license`, `version` (backward-compatible import/export).
- **J2 (S)** Display attribution on imported items (detail modal + card tooltip).

## 🎯 Epic K — Tech Debt & Polish (interleaved)

- **K1 (S)** Fix latent type gap — `handleImport` persists `description` but `PromptItem` lacks the field; add `description?`, surface it on cards + detail.
- **K2 (S)** Surface resolved dependency links as clickable chips in the detail view (currently count-only).
- **K3 (M)** Component tests with Testing Library — LibraryView create/edit/delete/copy flows in jsdom.
- **K4 (S)** PWA candidate — web manifest + minimal offline service worker (aligns with local-first); spike first, decide after Sprint 3.

---

## 🅿️ Parked (per roadmap)

Multi-device sync · hosted registry · webhook service — need a backend; revisit after Durability proves value.
