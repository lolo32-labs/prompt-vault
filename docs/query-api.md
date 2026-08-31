# 🔐 Agent Bridge — Query API Design (v0.1)

A local-only, opt-in `postMessage` bridge that lets other browser-based agents
(extensions, bookmarklets, companion pages) query the user's Prompt Vault.

**Status:** implemented · protocol version `1`

---

## Security model

The vault contains the user's prompt library. A careless bridge would let any
web page read it. The design therefore fails closed at every layer:

1. **Off by default.** With the master toggle off, the bridge does not exist:
   no listener is installed, no message is answered. Silence is intentional —
   the bridge never advertises itself.
2. **Origin allowlist.** Even when enabled, only origins the user explicitly
   added (e.g. `https://my-agent.example`) receive any response. Unknown or
   `null` origins get silence — never an error, which could be probed.
3. **Per-action permissions.** Allowed origins must additionally have the
   specific action enabled (`list`, `get`). `ping` is always allowed for
   allowlisted origins (it reveals no vault data).
4. **Read-only.** v0.1 implements `ping`, `list`, `get` only. There are no
   mutations, no delete, no export. Full-vault export is forbidden over the
   bridge by design — use the explicit JSON bundle flow instead.
5. **Rate limited.** 120 requests/minute/origin, in-memory. Burst abuse from a
   compromised allowlisted origin gets `RATE_LIMITED` instead of hammering
   IndexedDB.
6. **Minimal payloads.** `list` returns metadata only (id, name, type, tags,
   timestamps) — never content. Content is only served per-item via `get`.

### Threat model summary

| Threat | Mitigation |
|---|---|
| Random page probes for the bridge | Disabled-by-default + silence for unknown origins |
| Malicious origin added by phishing | Origins are plain strings the user types; per-action toggles limit blast radius; responses carry no more than asked |
| Compromised allowlisted origin exfiltrates library | `list` has no content; `get` is per-item and rate limited; no bulk export action exists |
| Malformed/hostile messages | Strict envelope validation; anything malformed is ignored |
| Bridge used as a mutation vector | Impossible — no mutating actions exist in v0.1 |

---

## Protocol

### Envelope

Request (sent via `window.postMessage` to the Vault's window):

```json
{ "pv": 1, "id": "req-42", "action": "list", "payload": {} }
```

Response (posted back with `event.source.postMessage(response, event.origin)`):

```json
{ "pv": 1, "id": "req-42", "ok": true, "data": {} }
```

```json
{ "pv": 1, "id": "req-42", "ok": false, "error": { "code": "PERMISSION_DENIED" } }
```

- `pv` — protocol version, currently `1`. Mismatched versions get silence.
- `id` — caller-supplied correlation id, echoed back verbatim.
- Messages that are not valid envelopes (`pv` missing/wrong, `id`/`action` not
  strings) are ignored entirely.

### Actions

| Action | Payload | Permission | Response `data` |
|---|---|---|---|
| `ping` | — | allowlist only | `{ name: "prompt-vault", protocol: 1, actions: ["ping","list","get"] }` |
| `list` | — | `list` | `{ items: [{ id, name, description?, type, tags?, createdAt, sourceUrl? }] }` — no content |
| `get` | `{ id: string }` | `get` | `{ item: PromptItem }` |

### Error codes

| Code | Meaning |
|---|---|
| `PERMISSION_DENIED` | Origin is allowlisted but the action's toggle is off |
| `RATE_LIMITED` | More than 120 requests/minute from this origin |
| `UNKNOWN_ACTION` | Action string not recognized |
| `BAD_REQUEST` | Payload failed validation (e.g. `get` without `id`) |
| `NOT_FOUND` | `get` with an id that doesn't exist |

Note: `DISABLED` and origin-rejection deliberately do **not** exist as error
codes — those cases produce silence (see security model).

---

## Implementation notes

- Handler factory (`createBridgeHandler`) is dependency-injected and fully
  unit-testable without a browser; `startBridge` wraps it in a
  `window.addEventListener("message")` listener and returns a cleanup fn.
- Settings live in IndexedDB (`bridge:settings`) next to vault data:
  `{ bridgeEnabled, allowedOrigins: string[], permissions: { list, get } }`.
- Origins are normalized through `new URL(raw).origin` and restricted to
  `http:`/`https:` — `file:`, `null`, and sandboxed origins are rejected.
- The listener is only installed while the master toggle is on.
