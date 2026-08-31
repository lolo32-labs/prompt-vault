import type { WatchCheckResult, WatchedRepo } from "@/types";
import { fetchRepoDefaultBranch, fetchRepoTree } from "@/lib/scanner";
import { saveWatch } from "@/lib/storage";

export interface WatchDiff {
  added: string[];
  changed: string[];
  removed: string[];
}

export function diffSnapshot(
  oldSnapshot: Record<string, string>,
  newSnapshot: Record<string, string>
): WatchDiff {
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const [path, sha] of Object.entries(newSnapshot)) {
    const prev = oldSnapshot[path];
    if (prev === undefined) added.push(path);
    else if (prev !== sha) changed.push(path);
  }
  for (const path of Object.keys(oldSnapshot)) {
    if (!(path in newSnapshot)) removed.push(path);
  }

  return { added, changed, removed };
}

/**
 * Check a single watched repo. On first check (empty snapshot) the result is
 * treated as a baseline: nothing is reported as added. The watch record is
 * persisted with the new etag/snapshot/lastCheckedAt on every attempt.
 */
export async function checkWatch(
  watch: WatchedRepo,
  options: { token?: string; signal?: AbortSignal } = {}
): Promise<WatchCheckResult> {
  const { owner, repo } = watch;
  const base: Omit<WatchCheckResult, "status"> = {
    owner,
    repo,
    added: [],
    changed: [],
    removed: [],
  };

  const persist = async (patch: Partial<WatchedRepo>) => {
    await saveWatch({ ...watch, ...patch });
  };

  try {
    let branch = watch.branch;
    if (!branch) {
      branch = await fetchRepoDefaultBranch(owner, repo, options.token, options.signal);
    }

    const tree = await fetchRepoTree(owner, repo, {
      branch,
      etag: watch.etag,
      token: options.token,
      signal: options.signal,
    });

    if (tree.status === "not-modified") {
      await persist({ branch, lastCheckedAt: Date.now(), lastError: undefined });
      return { ...base, status: "clean" };
    }

    const diff = diffSnapshot(watch.snapshot, tree.snapshot.files);
    const isBaseline = Object.keys(watch.snapshot).length === 0;

    await persist({
      branch,
      etag: tree.snapshot.etag,
      snapshot: tree.snapshot.files,
      lastCheckedAt: Date.now(),
      lastError: undefined,
    });

    if (isBaseline) return { ...base, status: "clean" };

    const hasChanges = diff.added.length > 0 || diff.changed.length > 0;
    return {
      ...base,
      status: hasChanges ? "changes" : "clean",
      added: diff.added,
      changed: diff.changed,
      removed: diff.removed,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check repository";
    try {
      await persist({ lastCheckedAt: Date.now(), lastError: message });
    } catch {
      // Persisting the error is best-effort; report it regardless.
    }
    return { ...base, status: "error", error: message };
  }
}

/**
 * Check a list of watches sequentially with a small stagger so bursts of
 * watches don't trip GitHub's unauthenticated rate limit.
 */
export async function checkWatches(
  watches: WatchedRepo[],
  options: { token?: string; signal?: AbortSignal; staggerMs?: number } = {}
): Promise<WatchCheckResult[]> {
  const results: WatchCheckResult[] = [];
  for (const watch of watches) {
    if (options.signal?.aborted) break;
    results.push(await checkWatch(watch, options));
    if (options.staggerMs && options.staggerMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.staggerMs));
    }
  }
  return results;
}
