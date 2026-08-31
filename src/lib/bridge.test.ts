import { describe, it, expect, vi } from "vitest";
import {
  createBridgeHandler,
  normalizeOrigin,
  type BridgeEventLike,
  type BridgeResponse,
} from "./bridge";
import type { BridgeSettings } from "@/types";

function makeSettings(overrides: Partial<BridgeSettings> = {}): BridgeSettings {
  return {
    version: 1,
    bridgeEnabled: true,
    allowedOrigins: ["https://agent.example"],
    permissions: { list: true, get: true },
    ...overrides,
  };
}

function makeEvent(origin: string, data: unknown): BridgeEventLike & { replies: unknown[] } {
  const replies: unknown[] = [];
  return {
    origin,
    data,
    source: {
      postMessage: vi.fn((msg: unknown) => replies.push(msg)),
    },
    replies,
  } as BridgeEventLike & { replies: unknown[] };
}

const ITEM = {
  id: "item-1",
  name: "Code Review",
  content: "Review this code",
  type: "prompt" as const,
  createdAt: 1,
};

const OPTIONS = {
  getSettings: () => makeSettings(),
  listItems: async () => [
    { id: "item-1", name: "Code Review", type: "prompt" as const, createdAt: 1 },
  ],
  getItem: async (id: string) => (id === "item-1" ? ITEM : null),
};

const req = (action: string, payload?: unknown, id = "r1") => ({ pv: 1, id, action, payload });

describe("normalizeOrigin", () => {
  it("normalizes http(s) origins", () => {
    expect(normalizeOrigin("https://agent.example/")).toBe("https://agent.example");
    expect(normalizeOrigin(" http://localhost:3000 ")).toBe("http://localhost:3000");
  });

  it("rejects non-http protocols and garbage", () => {
    expect(normalizeOrigin("file:///etc/passwd")).toBeNull();
    expect(normalizeOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeOrigin("not a url")).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
  });
});

describe("createBridgeHandler — silence rules", () => {
  it("is silent for malformed envelopes", async () => {
    const handler = createBridgeHandler(OPTIONS);
    const event = makeEvent("https://agent.example", { hello: 1 });
    await handler(event);
    expect(event.replies).toEqual([]);
  });

  it("is silent when the bridge is disabled, even for allowed origins", async () => {
    const handler = createBridgeHandler({
      ...OPTIONS,
      getSettings: () => makeSettings({ bridgeEnabled: false }),
    });
    const event = makeEvent("https://agent.example", req("ping"));
    await handler(event);
    expect(event.replies).toEqual([]);
  });

  it("is silent for unknown origins, even with a valid request", async () => {
    const handler = createBridgeHandler(OPTIONS);
    const event = makeEvent("https://evil.example", req("ping"));
    await handler(event);
    expect(event.replies).toEqual([]);
  });

  it("is silent for null/file origins", async () => {
    const handler = createBridgeHandler(OPTIONS);
    const event = makeEvent("null", req("ping"));
    await handler(event);
    expect(event.replies).toEqual([]);
  });
});

describe("createBridgeHandler — allowed flows", () => {
  it("answers ping from an allowed origin", async () => {
    const handler = createBridgeHandler(OPTIONS);
    const event = makeEvent("https://agent.example", req("ping"));
    await handler(event);
    expect(event.replies).toHaveLength(1);
    const res = event.replies[0] as BridgeResponse;
    expect(res.ok).toBe(true);
    expect(res.id).toBe("r1");
    expect(res.data).toMatchObject({ name: "prompt-vault", protocol: 1 });
  });

  it("serves list when permitted, without content", async () => {
    const handler = createBridgeHandler(OPTIONS);
    const event = makeEvent("https://agent.example", req("list"));
    await handler(event);
    const res = event.replies[0] as BridgeResponse;
    expect(res.ok).toBe(true);
    const items = (res.data as { items: Array<Record<string, unknown>> }).items;
    expect(items).toHaveLength(1);
    expect(items[0].content).toBeUndefined();
  });

  it("serves get for an existing id", async () => {
    const handler = createBridgeHandler(OPTIONS);
    const event = makeEvent("https://agent.example", req("get", { id: "item-1" }));
    await handler(event);
    const res = event.replies[0] as BridgeResponse;
    expect(res.ok).toBe(true);
    expect((res.data as { item: { id: string } }).item.id).toBe("item-1");
  });
});

describe("createBridgeHandler — permission and validation errors", () => {
  it("denies list when the permission toggle is off", async () => {
    const handler = createBridgeHandler({
      ...OPTIONS,
      getSettings: () => makeSettings({ permissions: { list: false, get: true } }),
    });
    const event = makeEvent("https://agent.example", req("list"));
    await handler(event);
    const res = event.replies[0] as BridgeResponse;
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("PERMISSION_DENIED");
  });

  it("denies get when the permission toggle is off", async () => {
    const handler = createBridgeHandler({
      ...OPTIONS,
      getSettings: () => makeSettings({ permissions: { list: false, get: false } }),
    });
    const event = makeEvent("https://agent.example", req("get", { id: "item-1" }));
    await handler(event);
    const res = event.replies[0] as BridgeResponse;
    expect(res.error?.code).toBe("PERMISSION_DENIED");
  });

  it("rejects get without an id", async () => {
    const handler = createBridgeHandler(OPTIONS);
    const event = makeEvent("https://agent.example", req("get", {}));
    await handler(event);
    const res = event.replies[0] as BridgeResponse;
    expect(res.error?.code).toBe("BAD_REQUEST");
  });

  it("reports NOT_FOUND for missing items", async () => {
    const handler = createBridgeHandler(OPTIONS);
    const event = makeEvent("https://agent.example", req("get", { id: "nope" }));
    await handler(event);
    const res = event.replies[0] as BridgeResponse;
    expect(res.error?.code).toBe("NOT_FOUND");
  });

  it("reports UNKNOWN_ACTION for unrecognized actions", async () => {
    const handler = createBridgeHandler(OPTIONS);
    const event = makeEvent("https://agent.example", req("export-all"));
    await handler(event);
    const res = event.replies[0] as BridgeResponse;
    expect(res.error?.code).toBe("UNKNOWN_ACTION");
  });
});

describe("createBridgeHandler — rate limiting", () => {
  it("rate limits after the per-origin cap", async () => {
    const handler = createBridgeHandler(OPTIONS);
    let limited = 0;
    for (let i = 0; i < 125; i++) {
      const event = makeEvent("https://agent.example", req("ping", undefined, `r${i}`));
      await handler(event);
      const last = event.replies[0] as BridgeResponse | undefined;
      if (last && !last.ok && last.error?.code === "RATE_LIMITED") limited++;
    }
    expect(limited).toBeGreaterThan(0);
  });

  it("tracks rate limits per origin", async () => {
    const handler = createBridgeHandler(OPTIONS);
    const a = makeEvent("https://agent.example", req("ping"));
    await handler(a);
    expect(a.replies).toHaveLength(1);

    const handlerSettings = makeSettings({
      allowedOrigins: ["https://agent.example", "https://other.example"],
    });
    const handler2 = createBridgeHandler({
      ...OPTIONS,
      getSettings: () => handlerSettings,
    });
    const b = makeEvent("https://other.example", req("ping"));
    await handler2(b);
    expect(b.replies).toHaveLength(1);
  });
});
