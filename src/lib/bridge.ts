import type { BridgeSettings, PromptItem } from "@/types";

export const BRIDGE_PROTOCOL_VERSION = 1 as const;
export const BRIDGE_RATE_LIMIT = { max: 120, windowMs: 60_000 };

export interface BridgeListItem {
  id: string;
  name: string;
  description?: string;
  type: "prompt" | "skill";
  tags?: string[];
  createdAt: number;
  sourceUrl?: string;
}

export interface BridgeRequest {
  pv: typeof BRIDGE_PROTOCOL_VERSION;
  id: string;
  action: string;
  payload?: unknown;
}

export interface BridgeResponse {
  pv: typeof BRIDGE_PROTOCOL_VERSION;
  id: string;
  ok: boolean;
  data?: unknown;
  error?: { code: string; message?: string };
}

/**
 * Normalize a user-supplied origin string to a strict `protocol://host` form.
 * Returns null for anything that isn't http(s) — file:, null, and sandboxed
 * origins are always rejected.
 */
export function normalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export interface BridgeSourceLike {
  postMessage: (message: unknown, targetOrigin: string) => void;
}

export interface BridgeEventLike {
  origin: string;
  source: BridgeSourceLike | null;
  data?: unknown;
}

export interface BridgeHandlerOptions {
  getSettings: () => BridgeSettings | Promise<BridgeSettings>;
  listItems: () => Promise<BridgeListItem[]>;
  getItem: (id: string) => Promise<PromptItem | null>;
}

/**
 * Create the message handler. Fails closed:
 * - malformed envelopes → silence
 * - bridge disabled → silence
 * - unknown origin → silence
 * Only allowlisted origins with the matching per-action permission get data.
 */
export function createBridgeHandler(options: BridgeHandlerOptions) {
  const rate = new Map<string, { count: number; resetAt: number }>();

  return async function handle(event: BridgeEventLike): Promise<void> {
    const reply = (response: BridgeResponse) => {
      event.source?.postMessage?.(response, event.origin);
    };

    const data = event.data as BridgeRequest | undefined;
    if (
      !data ||
      typeof data !== "object" ||
      data.pv !== BRIDGE_PROTOCOL_VERSION ||
      typeof data.id !== "string" ||
      typeof data.action !== "string"
    ) {
      return;
    }
    const id = data.id;

    const settings = await options.getSettings();
    if (!settings.bridgeEnabled) return;

    const origin = normalizeOrigin(event.origin);
    if (!origin || !settings.allowedOrigins.includes(origin)) return;

    // Rate limit per allowlisted origin.
    const now = Date.now();
    const bucket = rate.get(origin);
    if (!bucket || now >= bucket.resetAt) {
      rate.set(origin, { count: 1, resetAt: now + BRIDGE_RATE_LIMIT.windowMs });
    } else if (bucket.count >= BRIDGE_RATE_LIMIT.max) {
      reply({
        pv: BRIDGE_PROTOCOL_VERSION,
        id,
        ok: false,
        error: { code: "RATE_LIMITED" },
      });
      return;
    } else {
      bucket.count++;
    }

    const fail = (code: string, message?: string) =>
      reply({ pv: BRIDGE_PROTOCOL_VERSION, id, ok: false, error: { code, message } });

    switch (data.action) {
      case "ping":
        reply({
          pv: BRIDGE_PROTOCOL_VERSION,
          id,
          ok: true,
          data: {
            name: "prompt-vault",
            protocol: BRIDGE_PROTOCOL_VERSION,
            actions: ["ping", "list", "get"],
          },
        });
        return;

      case "list": {
        if (!settings.permissions.list) return fail("PERMISSION_DENIED");
        const items = await options.listItems();
        reply({ pv: BRIDGE_PROTOCOL_VERSION, id, ok: true, data: { items } });
        return;
      }

      case "get": {
        if (!settings.permissions.get) return fail("PERMISSION_DENIED");
        const payloadId =
          data.payload && typeof data.payload === "object" && "id" in (data.payload as Record<string, unknown>)
            ? (data.payload as Record<string, unknown>).id
            : undefined;
        if (typeof payloadId !== "string" || !payloadId) {
          return fail("BAD_REQUEST", "payload.id (string) is required");
        }
        const item = await options.getItem(payloadId);
        if (!item) return fail("NOT_FOUND");
        reply({ pv: BRIDGE_PROTOCOL_VERSION, id, ok: true, data: { item } });
        return;
      }

      default:
        return fail("UNKNOWN_ACTION");
    }
  };
}

/**
 * Install the bridge listener for as long as the caller wants it active.
 * Returns a cleanup function that removes the listener.
 */
export function startBridge(options: BridgeHandlerOptions): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = createBridgeHandler(options);
  const listener = (event: MessageEvent) => {
    const source = event.source as { postMessage: (message: unknown, targetOrigin: string) => void } | null;
    void handler({
      origin: event.origin,
      source: source && typeof source.postMessage === "function" ? source : null,
      data: event.data,
    });
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
