import { describe, it, expect } from "vitest";
import { shouldNudgeBackup } from "./backup";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

describe("shouldNudgeBackup", () => {
  it("never nudges an empty vault", () => {
    expect(shouldNudgeBackup({}, 0, NOW)).toBe(false);
  });

  it("does not nudge a small vault that never exported", () => {
    expect(shouldNudgeBackup({}, 5, NOW)).toBe(false);
  });

  it("nudges once the vault reaches the item threshold without an export", () => {
    expect(shouldNudgeBackup({}, 10, NOW)).toBe(true);
    expect(shouldNudgeBackup({}, 25, NOW)).toBe(true);
  });

  it("does not nudge shortly after an export", () => {
    const meta = { lastExportAt: NOW - 5 * DAY, itemsAtExport: 12 };
    expect(shouldNudgeBackup(meta, 15, NOW)).toBe(false);
  });

  it("nudges after 30 days without an export", () => {
    const meta = { lastExportAt: NOW - 31 * DAY, itemsAtExport: 12 };
    expect(shouldNudgeBackup(meta, 12, NOW)).toBe(true);
  });

  it("does not nudge at 29 days", () => {
    const meta = { lastExportAt: NOW - 29 * DAY, itemsAtExport: 12 };
    expect(shouldNudgeBackup(meta, 12, NOW)).toBe(false);
  });

  it("nudges when 10+ new items were added since the last export", () => {
    const meta = { lastExportAt: NOW - 2 * DAY, itemsAtExport: 5 };
    expect(shouldNudgeBackup(meta, 15, NOW)).toBe(true);
    expect(shouldNudgeBackup(meta, 14, NOW)).toBe(false);
  });

  it("respects a recent dismissal even when conditions are met", () => {
    const meta = { lastExportAt: NOW - 40 * DAY, lastDismissedAt: NOW - 5 * DAY };
    expect(shouldNudgeBackup(meta, 40, NOW)).toBe(false);
  });

  it("nudges again after the dismissal window passes", () => {
    const meta = { lastExportAt: NOW - 40 * DAY, lastDismissedAt: NOW - 15 * DAY };
    expect(shouldNudgeBackup(meta, 40, NOW)).toBe(true);
  });
});
