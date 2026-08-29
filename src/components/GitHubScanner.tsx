"use client";

import { useState, useRef, useEffect } from "react";
import { scanGitHubRepo } from "@/lib/scanner";
import { ScannedItem } from "@/types";
import {
  Search,
  Loader2,
  Github,
  ChevronRight,
  AlertCircle,
  Sparkles,
  KeyRound,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ScannerProps {
  onItemsScanned: (items: ScannedItem[]) => void;
}

export default function GitHubScanner({ onItemsScanned }: ScannerProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "scanning" | "analyzing">("idle");
  const [token, setToken] = useState("");
  const [showTokenField, setShowTokenField] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setStep("scanning");

    try {
      setStep("analyzing");
      const items = await scanGitHubRepo(url, {
        signal: controller.signal,
        token: token.trim() || undefined,
      });
      onItemsScanned(items);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(
        err instanceof Error
          ? err.message
          : "Repository scan failed. Ensure the URL is a valid public GitHub repository."
      );
      setStep("idle");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass rounded-2xl p-6 md:p-8 border border-surface-800/50 shadow-2xl overflow-hidden relative gradient-border">
        {/* Background glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-accent-500/8 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-violet-500/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 bg-surface-900 border border-surface-800/50 rounded-xl flex items-center justify-center text-surface-300 shadow-inner">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-surface-50">
                GitHub Scanner
              </h2>
              <p className="text-surface-500 text-xs">
                Enter the URL of a public repository to scan.
              </p>
            </div>
          </div>

          <form onSubmit={handleScan} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-surface-500 uppercase tracking-widest ml-0.5">
                Repository URL
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  disabled={loading}
                  className="w-full px-5 py-3.5 pl-12 bg-surface-950/60 border border-surface-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500/30 text-sm text-surface-100 transition-all placeholder:text-surface-600 disabled:opacity-50"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-600 group-focus-within:text-accent-400 transition-colors" />

                <AnimatePresence>
                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      <Loader2 className="h-4 w-4 text-accent-400 animate-spin" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowTokenField((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-surface-500 hover:text-surface-300 transition-colors"
              >
                <KeyRound className="h-3 w-3" />
                Access token {showTokenField ? "(hide)" : "(optional)"}
                <span className="text-[9px] text-surface-600">— raises the 60/hr rate limit</span>
              </button>
              <AnimatePresence>
                {showTokenField && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_... (kept in memory only, never stored)"
                      autoComplete="off"
                      disabled={loading}
                      aria-label="GitHub personal access token"
                      className="mt-2 w-full px-4 py-2.5 bg-surface-950/60 border border-surface-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500/30 text-xs text-surface-100 transition-all placeholder:text-surface-600 disabled:opacity-50"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              disabled={loading || !url}
              className="w-full py-3.5 gradient-accent hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-accent-500/15 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {step === "scanning"
                    ? "Connecting..."
                    : "Analyzing repository..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Start Scan
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5"
              >
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 pt-4 border-t border-surface-800/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-surface-500 text-[10px] font-medium">
              <Sparkles className="h-3 w-3 text-accent-400" />
              Auto-detects <code className="text-accent-400/70">SKILL.md</code>
            </div>
            <div className="flex items-center gap-1.5 text-surface-500 text-[10px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
              Ready
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
