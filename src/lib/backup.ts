import type { BackupMeta } from "@/types";

export const BACKUP_NUDGE_DAYS = 30;
export const BACKUP_NUDGE_ITEMS = 10;
export const BACKUP_DISMISS_DAYS = 14;

const DAY_MS = 86_400_000;

/**
 * Decide whether to show the backup nudge.
 * - Empty vaults never nag.
 * - Nudge after 30 days without an export, or once 10+ new items have been
 *   added since the last export (or ever, if the user never exported).
 * - Dismissing silences the nudge for 14 days, then conditions re-evaluate.
 */
export function shouldNudgeBackup(
  meta: BackupMeta,
  itemCount: number,
  now: number = Date.now()
): boolean {
  if (itemCount <= 0) return false;

  if (meta.lastDismissedAt) {
    if (now - meta.lastDismissedAt < BACKUP_DISMISS_DAYS * DAY_MS) return false;
  }

  if (meta.lastExportAt === undefined) {
    return itemCount >= BACKUP_NUDGE_ITEMS;
  }

  const daysSinceExport = (now - meta.lastExportAt) / DAY_MS;
  if (daysSinceExport >= BACKUP_NUDGE_DAYS) return true;

  const itemsSinceExport = Math.max(0, itemCount - (meta.itemsAtExport ?? 0));
  return itemsSinceExport >= BACKUP_NUDGE_ITEMS;
}
