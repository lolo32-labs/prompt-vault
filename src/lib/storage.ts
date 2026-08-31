import { get, set, del, keys } from 'idb-keyval';
import { PromptItem, PromptHistoryEntry, WatchedRepo, BridgeSettings, BackupMeta } from '@/types';

/** Maximum number of prior versions kept per item. */
export const HISTORY_LIMIT = 20;

function semanticSnapshot(item: PromptItem): Omit<PromptHistoryEntry, 'savedAt'> {
  return {
    name: item.name,
    description: item.description,
    content: item.content,
    type: item.type,
    tags: item.tags,
  };
}

function snapshotsEqual(a: Omit<PromptHistoryEntry, 'savedAt'>, b: Omit<PromptHistoryEntry, 'savedAt'>): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.content === b.content &&
    a.type === b.type &&
    JSON.stringify(a.tags ?? []) === JSON.stringify(b.tags ?? [])
  );
}

/**
 * Pure helper: return `item` with `previous` pushed onto its bounded history
 * ring. Skips the push when nothing semantic changed. Callers persist the
 * result themselves.
 */
export function withPriorVersion(item: PromptItem, previous: PromptItem): PromptItem {
  const prevSnapshot = semanticSnapshot(previous);
  const nextSnapshot = semanticSnapshot(item);
  if (snapshotsEqual(prevSnapshot, nextSnapshot)) return item;
  const entry: PromptHistoryEntry = { ...prevSnapshot, savedAt: Date.now() };
  return { ...item, history: [entry, ...(previous.history ?? [])].slice(0, HISTORY_LIMIT) };
}

export async function savePrompt(prompt: PromptItem): Promise<void> {
  await set(prompt.id, prompt);
}

export async function savePrompts(prompts: PromptItem[]): Promise<void> {
  await Promise.all(prompts.map((p) => set(p.id, p)));
}

export async function updatePrompt(prompt: PromptItem): Promise<void> {
  const current = await get<PromptItem>(prompt.id);
  const withHistory = current ? withPriorVersion(prompt, current) : prompt;
  await set(prompt.id, withHistory);
}

export async function getAllPrompts(): Promise<PromptItem[]> {
  const allKeys = await keys();
  const prompts = await Promise.all(allKeys.map(key => get<PromptItem>(key)));
  return prompts.filter((p): p is PromptItem => !!p && typeof p.name === 'string' && typeof p.id === 'string');
}

export async function deletePrompt(id: string): Promise<void> {
  await del(id);
}

/* ─── Watched Repos ─────────────────────── */

const WATCH_PREFIX = 'watch:';

function watchKey(owner: string, repo: string): string {
  return `${WATCH_PREFIX}${owner}/${repo}`.toLowerCase();
}

export async function getWatch(owner: string, repo: string): Promise<WatchedRepo | undefined> {
  return get<WatchedRepo>(watchKey(owner, repo));
}

export async function listWatches(): Promise<WatchedRepo[]> {
  const allKeys = await keys();
  const watchKeys = allKeys.filter(
    (k): k is string => typeof k === 'string' && k.startsWith(WATCH_PREFIX)
  );
  const watches = await Promise.all(watchKeys.map((k) => get<WatchedRepo>(k)));
  return watches.filter(
    (w): w is WatchedRepo => !!w && typeof w.owner === 'string' && typeof w.repo === 'string'
  );
}

export async function saveWatch(watch: WatchedRepo): Promise<void> {
  await set(watchKey(watch.owner, watch.repo), watch);
}

export async function removeWatch(owner: string, repo: string): Promise<void> {
  await del(watchKey(owner, repo));
}

/* ─── Agent Bridge settings ─────────────── */

const BRIDGE_KEY = 'bridge:settings';

export const DEFAULT_BRIDGE_SETTINGS: BridgeSettings = {
  version: 1,
  bridgeEnabled: false,
  allowedOrigins: [],
  permissions: { list: false, get: false },
};

export async function getPromptById(id: string): Promise<PromptItem | undefined> {
  const p = await get<PromptItem>(id);
  if (p && typeof p.id === 'string' && typeof p.name === 'string') return p;
  return undefined;
}

export async function getBridgeSettings(): Promise<BridgeSettings> {
  const s = await get<Partial<BridgeSettings>>(BRIDGE_KEY);
  if (!s || typeof s !== 'object') {
    return { ...DEFAULT_BRIDGE_SETTINGS, permissions: { ...DEFAULT_BRIDGE_SETTINGS.permissions } };
  }
  return {
    version: 1,
    bridgeEnabled: !!s.bridgeEnabled,
    allowedOrigins: Array.isArray(s.allowedOrigins)
      ? s.allowedOrigins.filter((o): o is string => typeof o === 'string')
      : [],
    permissions: {
      list: !!s.permissions?.list,
      get: !!s.permissions?.get,
    },
  };
}

export async function saveBridgeSettings(settings: BridgeSettings): Promise<void> {
  await set(BRIDGE_KEY, settings);
}

/* ─── Backup meta ───────────────────────── */

const BACKUP_KEY = 'meta:backup';

export async function getBackupMeta(): Promise<BackupMeta> {
  const m = await get<BackupMeta>(BACKUP_KEY);
  return m && typeof m === 'object' ? m : {};
}

export async function saveBackupMeta(meta: BackupMeta): Promise<void> {
  await set(BACKUP_KEY, meta);
}
