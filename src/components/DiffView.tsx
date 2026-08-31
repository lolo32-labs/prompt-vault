"use client";

import { useMemo } from "react";
import { diffLines } from "@/lib/diff";

export default function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const lines = useMemo(() => diffLines(oldText, newText), [oldText, newText]);

  const additions = lines.filter((l) => l.type === "add").length;
  const removals = lines.filter((l) => l.type === "remove").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-[10px] font-mono">
        <span className="text-emerald-400">+{additions}</span>
        <span className="text-rose-400">−{removals}</span>
        <span className="text-surface-600">vs current</span>
      </div>
      <div className="rounded-xl border border-surface-800/50 bg-surface-950/60 overflow-x-auto max-h-[50vh] overflow-y-auto font-mono text-[11px] leading-relaxed">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={
              line.type === "add"
                ? "bg-emerald-500/10 text-emerald-300"
                : line.type === "remove"
                  ? "bg-rose-500/10 text-rose-300"
                  : "text-surface-500"
            }
          >
            <span className="select-none inline-block w-6 text-center opacity-60 shrink-0">
              {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
            </span>
            <span className="whitespace-pre-wrap break-words">{line.text || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
