"use client";

import { Users, Loader2, ExternalLink, Plus } from "lucide-react";
import registryData from "@/data/community-registry.json";

interface RegistryRepo {
  name: string;
  description: string;
  repo: string;
  tags?: string[];
  addedAt?: string;
}

interface CommunityRegistryProps {
  scanningUrl: string | null;
  onPick: (repoUrl: string) => void | Promise<void>;
}

export default function CommunityRegistry({ scanningUrl, onPick }: CommunityRegistryProps) {
  const repos = (registryData.repos ?? []) as RegistryRepo[];
  if (repos.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-6 md:p-8 border border-surface-800/50 w-full">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-surface-900 border border-surface-800/50 flex items-center justify-center text-accent-400">
            <Users className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-surface-100 text-sm">Community Registry</h3>
            <p className="text-[11px] text-surface-500">
              A vetted, PR-curated list of repos worth scanning.
            </p>
          </div>
        </div>
        <a
          href="https://github.com/lolo32-labs/prompt-vault/blob/main/src/data/community-registry.json"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-surface-500 hover:text-accent-400 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Suggest a repo
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {repos.map((entry) => {
          const scanning = scanningUrl === entry.repo;
          return (
            <div
              key={entry.repo}
              className="group flex flex-col p-4 rounded-xl border border-surface-800/40 bg-surface-950/40 hover:border-surface-700/50 hover:bg-surface-900/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <span className="font-semibold text-sm text-surface-200 truncate">
                  {entry.name}
                </span>
                <button
                  onClick={() => void onPick(entry.repo)}
                  disabled={!!scanningUrl}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-500/10 border border-accent-500/25 text-[11px] font-semibold text-accent-400 hover:bg-accent-500/20 disabled:opacity-40 transition-colors"
                >
                  {scanning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3 w-3" />
                  )}
                  {scanning ? "Scanning…" : "Scan"}
                </button>
              </div>
              <p className="text-[11px] text-surface-400 leading-relaxed line-clamp-2 mb-2">
                {entry.description}
              </p>
              <div className="mt-auto flex items-center gap-1.5 flex-wrap">
                {entry.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 max-w-[7rem] truncate bg-surface-800/60 rounded text-[9px] text-surface-400 font-medium"
                  >
                    #{tag}
                  </span>
                ))}
                <span className="ml-auto text-[9px] text-surface-700 font-mono truncate">
                  {entry.repo.replace("https://github.com/", "")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
