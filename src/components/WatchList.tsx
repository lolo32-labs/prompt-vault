"use client";

import { Eye, RefreshCw, X, AlertCircle, Plus } from "lucide-react";
import type { WatchCheckResult, WatchedRepo } from "@/types";
import { cn } from "@/lib/utils";

function relativeTime(ts?: number): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

interface WatchListProps {
  watches: WatchedRepo[];
  results: Record<string, WatchCheckResult>;
  checking: boolean;
  onCheckAll: () => void;
  onOpenReview: (watch: WatchedRepo) => void;
  onRemove: (watch: WatchedRepo) => void;
}

export default function WatchList({
  watches,
  results,
  checking,
  onCheckAll,
  onOpenReview,
  onRemove,
}: WatchListProps) {
  if (watches.length === 0) return null;

  const keyOf = (w: WatchedRepo) => `${w.owner}/${w.repo}`.toLowerCase();

  return (
    <div>
      <div className="flex items-center justify-between px-3 mb-2">
        <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-widest">
          Watched Repos
        </p>
        <button
          onClick={onCheckAll}
          disabled={checking}
          aria-label="Check all watched repos"
          title={checking ? "Checking…" : "Check now"}
          className="p-1 text-surface-500 hover:text-accent-400 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={cn("h-3 w-3", checking && "animate-spin")} />
        </button>
      </div>

      <div className="space-y-1">
        {watches.map((watch) => {
          const key = keyOf(watch);
          const result = results[key];
          const changeCount =
            (result?.added.length ?? 0) + (result?.changed.length ?? 0);
          const hasError = result?.status === "error" || !!watch.lastError;
          const dotClass = hasError
            ? "bg-rose-400"
            : changeCount > 0
              ? "bg-accent-400 animate-pulse"
              : "bg-surface-600";

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onOpenReview(watch)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenReview(watch);
                }
              }}
              className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer text-surface-400 hover:text-surface-100 hover:bg-surface-800/40 transition-all duration-200"
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotClass)} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-surface-300 group-hover:text-surface-100 truncate flex items-center gap-1.5">
                  <Eye className="h-3 w-3 shrink-0 text-surface-600" />
                  {watch.owner}/{watch.repo}
                </div>
                <div className="text-[10px] text-surface-600 truncate">
                  {hasError ? (
                    <span className="text-rose-400/80 flex items-center gap-1">
                      <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                      {result?.error ?? watch.lastError}
                    </span>
                  ) : changeCount > 0 ? (
                    <span className="text-accent-400">
                      {changeCount} update{changeCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <>checked {relativeTime(watch.lastCheckedAt)}</>
                  )}
                </div>
              </div>
              {changeCount > 0 && (
                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-500/15 text-accent-400">
                  {changeCount}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(watch);
                }}
                aria-label={`Stop watching ${watch.owner}/${watch.repo}`}
                className="shrink-0 p-1 rounded text-surface-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      <p className="px-3 pt-2 text-[9px] text-surface-700 leading-relaxed flex items-center gap-1">
        <Plus className="h-2.5 w-2.5 shrink-0" />
        Watch repos from any scan result
      </p>
    </div>
  );
}
