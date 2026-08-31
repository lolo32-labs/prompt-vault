"use client";

import { useState } from "react";
import { ScannedItem } from "@/types";
import {
  FileText,
  Zap,
  Import,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Info,
  Loader2,
  FolderOpen,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn, duplicateKey } from "@/lib/utils";

interface ImportSelectorProps {
  items: ScannedItem[];
  onImport: (selectedItems: ScannedItem[], options?: { replaceDuplicates?: boolean }) => void | Promise<void>;
  onCancel: () => void;
  existingKeys?: Set<string>;
  repo?: { owner: string; repo: string };
  watched?: boolean;
  onWatch?: () => void | Promise<void>;
}

export default function ImportSelector({
  items,
  onImport,
  onCancel,
  existingKeys,
  repo,
  watched,
  onWatch,
}: ImportSelectorProps) {
  const isDuplicate = (item: ScannedItem) =>
    existingKeys?.has(duplicateKey(item.type, item.name)) ?? false;

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    new Set(items.filter((i) => !isDuplicate(i)).map((i) => i.path))
  );
  const [importing, setImporting] = useState(false);

  const toggleItem = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedPaths(next);
  };

  const selectAll = () => {
    setSelectedPaths(new Set(items.map((i) => i.path)));
  };

  const deselectAll = () => {
    setSelectedPaths(new Set());
  };

  const handleImport = async (options?: { replaceDuplicates?: boolean }) => {
    setImporting(true);
    const selected = items.filter((item) => selectedPaths.has(item.path));
    await onImport(selected, options);
    setImporting(false);
  };

  const duplicateCount = items.filter(isDuplicate).length;
  const newCount = items.filter((i) => i.watchStatus === "new").length;
  const changedCount = items.filter((i) => i.watchStatus === "changed").length;
  const isReview = newCount + changedCount > 0;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-5 max-h-[calc(100vh-300px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between glass p-5 rounded-2xl border border-surface-800/50 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2.5 bg-surface-900/80 border border-surface-800/50 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-all active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-lg font-bold text-surface-50 tracking-tight">
                {isReview ? "Updates Found" : "Scan Results"}
              </h2>
              <span className="px-2 py-0.5 bg-accent-500/10 border border-accent-500/20 rounded-full text-accent-400 text-[10px] font-semibold">
                {items.length} found
              </span>
              {isReview && repo && (
                <span className="px-2 py-0.5 bg-surface-800 border border-surface-700/50 rounded-full text-surface-400 text-[10px] font-medium font-mono truncate max-w-[12rem]">
                  {repo.owner}/{repo.repo}
                </span>
              )}
            </div>
            <p className="text-surface-500 text-xs">
              {isReview
                ? "New and changed files since your last check."
                : "Select items to import into your vault."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {repo && onWatch && (
            <button
              onClick={() => void onWatch()}
              disabled={watched}
              title={watched ? "Already watching this repo" : "Get notified when this repo changes"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                watched
                  ? "border-surface-800/50 bg-surface-900/40 text-surface-500 cursor-default"
                  : "border-accent-500/25 bg-accent-500/10 text-accent-400 hover:bg-accent-500/20"
              )}
            >
              {watched ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {watched ? "Watching" : "Watch repo"}
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-accent-400 hover:text-accent-300 font-medium transition-colors"
            >
              Select All
            </button>
            <span className="text-surface-700">·</span>
            <button
              onClick={deselectAll}
              className="text-xs text-surface-500 hover:text-surface-400 font-medium transition-colors"
            >
              Clear
            </button>
          </div>
          <button
            onClick={() => void handleImport(isReview ? { replaceDuplicates: true } : undefined)}
            disabled={selectedPaths.size === 0 || importing}
            className="px-5 py-2.5 gradient-accent hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-accent-500/15 active:scale-[0.98] text-sm"
          >
            {importing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Import className="h-4 w-4" />
                Import {selectedPaths.size}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <FolderOpen className="h-10 w-10 text-surface-600 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-surface-300">No items found</h3>
            <p className="text-surface-500 mt-1 text-sm max-w-xs mx-auto">
              This repository has no recognizable <code className="text-accent-400/70">SKILL.md</code> or{" "}
              <code className="text-accent-400/70">.prompt</code> files.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-3.5 auto-rows-max">
        {items.map((item, index) => {
          const isSelected = selectedPaths.has(item.path);
          return (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.25 }}
              onClick={() => toggleItem(item.path)}
              className={cn(
                "group cursor-pointer flex flex-col p-4 rounded-xl border transition-all duration-200",
                isSelected
                  ? "bg-accent-500/8 border-accent-500/30"
                  : "bg-surface-950/40 border-surface-800/40 hover:border-surface-700/50 hover:bg-surface-900/30"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={cn(
                    "p-2.5 rounded-xl transition-colors",
                    isSelected
                      ? "bg-accent-500 text-white"
                      : "bg-surface-900 text-surface-400 group-hover:text-surface-200"
                  )}
                >
                  {item.type === "skill" ? (
                    <Zap className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.watchStatus === "new" && (
                    <span className="px-1.5 py-0.5 rounded bg-accent-500/15 text-accent-400 text-[9px] font-semibold uppercase">
                      New
                    </span>
                  )}
                  {item.watchStatus === "changed" && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-semibold uppercase">
                      Changed
                    </span>
                  )}
                  {isDuplicate(item) && (
                    <span
                      title="Already in your vault"
                      className="px-1.5 py-0.5 rounded bg-surface-800 text-surface-500 text-[9px] font-semibold uppercase"
                    >
                      In vault
                    </span>
                  )}
                  {isSelected ? (
                    <CheckCircle2 className="h-5 w-5 text-accent-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-surface-800 group-hover:text-surface-600" />
                  )}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "font-semibold text-sm truncate",
                      isSelected ? "text-surface-100" : "text-surface-200"
                    )}
                  >
                    {item.name}
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase shrink-0",
                      item.type === "skill"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-sky-500/10 text-sky-400"
                    )}
                  >
                    {item.type}
                  </span>
                </div>
                {item.description ? (
                  <p className="text-[11px] text-surface-400 line-clamp-2 leading-relaxed mb-1.5">
                    {item.description}
                  </p>
                ) : null}
                <p className="text-[10px] text-surface-500 font-mono truncate bg-surface-950/40 px-2 py-1 rounded border border-surface-800/30">
                  {item.path}
                </p>
              </div>

              {item.dependencies && item.dependencies.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-surface-500">
                  <div className="flex -space-x-1.5">
                    {item.dependencies.slice(0, 3).map((_, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-full bg-surface-800 border-2 border-surface-950 flex items-center justify-center"
                      >
                        <div className="w-1 h-1 rounded-full bg-surface-600" />
                      </div>
                    ))}
                  </div>
                  <span>{item.dependencies.length} dependencies</span>
                </div>
              )}
            </motion.div>
          );
        })}
        </div>
      )}

      {/* Info footer */}
      <div className="glass rounded-xl p-3.5 border border-surface-800/40 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center text-accent-400 shrink-0">
          <Info className="h-4 w-4" />
        </div>
        <p className="text-[11px] text-surface-400 leading-relaxed">
          {isReview ? (
            <>
              <span className="text-accent-400 font-semibold">{newCount} new</span> and{" "}
              <span className="text-amber-400 font-semibold">{changedCount} changed</span> since
              your last check. Changed items update the existing entry.
            </>
          ) : (
            <>
              Found{" "}
              <span className="text-surface-200 font-semibold">
                {items.filter((i) => i.type === "skill").length} skills
              </span>{" "}
              and{" "}
              <span className="text-surface-200 font-semibold">
                {items.filter((i) => i.type === "prompt").length} prompts
              </span>
              {duplicateCount > 0 && (
                <>
                  {" · "}
                  <span className="text-amber-400 font-semibold">
                    {duplicateCount} already in your vault
                  </span>{" "}
                  (pre-deselected)
                </>
              )}
              . All data will be stored locally in your browser.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
