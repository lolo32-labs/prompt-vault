"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isQuota =
    error.name === "QuotaExceededError" ||
    /quota|storage full/i.test(error.message || "");

  return (
    <main className="min-h-screen bg-surface-950 flex items-center justify-center p-6 font-sans">
      <div className="glass max-w-md w-full rounded-2xl border border-surface-700/50 shadow-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="h-7 w-7 text-rose-400" />
        </div>
        <h1 className="text-xl font-bold text-surface-50 mb-2">
          {isQuota ? "Vault storage is full" : "Something went wrong"}
        </h1>
        <p className="text-sm text-surface-400 leading-relaxed">
          {isQuota
            ? "Your browser storage quota was exceeded. Export a bundle and remove old prompts to free up space."
            : "An unexpected error occurred while rendering the app. Your data stays safe in local IndexedDB."}
        </p>
        {!isQuota && (
          <p className="mt-3 text-[11px] text-surface-600 font-mono break-words">
            {error.message || "Unknown error"}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 gradient-accent hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-all active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </main>
  );
}
