import { describe, it, expect } from "vitest";
import { bundleCrypto } from "./crypto";

const DATA = {
  version: "1.1.0",
  items: [
    { id: "a", name: "Prompt A", content: "hello world", type: "prompt" },
    { id: "b", name: "Skill B", content: "# skill\nwith unicode ✓ 中文", type: "skill" },
  ],
};

describe("bundleCrypto", () => {
  it("round-trips a payload", async () => {
    const payload = await bundleCrypto.encryptJson(DATA, "correct horse battery");
    const result = await bundleCrypto.decryptJson<typeof DATA>(payload, "correct horse battery");
    expect(result).toEqual(DATA);
  });

  it("rejects a wrong password", async () => {
    const payload = await bundleCrypto.encryptJson(DATA, "right-password");
    await expect(bundleCrypto.decryptJson(payload, "wrong-password")).rejects.toThrow(
      "Incorrect password or corrupted file."
    );
  });

  it("rejects tampered ciphertext", async () => {
    const payload = await bundleCrypto.encryptJson(DATA, "password");
    const bytes = atob(payload.ciphertext);
    const tampered = (bytes.charCodeAt(0) ^ 0x01).toString(16).padStart(2, "0") + bytes.slice(1);
    payload.ciphertext = btoa(tampered);
    await expect(bundleCrypto.decryptJson<typeof DATA>(payload, "password")).rejects.toThrow(
      "Incorrect password or corrupted file."
    );
  });

  it("uses a fresh salt and iv per encryption", async () => {
    const a = await bundleCrypto.encryptJson(DATA, "same-password");
    const b = await bundleCrypto.encryptJson(DATA, "same-password");
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("records kdf parameters in the payload", async () => {
    const payload = await bundleCrypto.encryptJson(DATA, "pw");
    expect(payload.v).toBe(1);
    expect(payload.kdf).toBe("PBKDF2-SHA256");
    expect(payload.iterations).toBeGreaterThanOrEqual(100_000);
  });
});
