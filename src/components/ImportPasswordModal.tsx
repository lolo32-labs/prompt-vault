"use client";

import { useState } from "react";
import { X, Lock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useFocusTrap } from "@/lib/hooks";

interface ImportPasswordModalProps {
  fileName: string;
  onClose: () => void;
  /** Throws Error with a friendly message on failure. */
  onUnlock: (password: string) => Promise<void>;
}

export default function ImportPasswordModal({
  fileName,
  onClose,
  onUnlock,
}: ImportPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);

  const unlock = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await onUnlock(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decrypt this bundle.");
      setBusy(false);
      return;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pv-unlock-title"
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-sm glass rounded-2xl border border-surface-700/50 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-surface-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-500/10 text-accent-400 flex items-center justify-center">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 id="pv-unlock-title" className="text-lg font-bold text-surface-50">
                Encrypted bundle
              </h3>
              <p className="text-xs text-surface-500 truncate max-w-[12rem]">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void unlock();
          }}
          className="p-5 space-y-4"
        >
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="Bundle password"
            autoFocus
            aria-label="Bundle password"
            className="w-full px-4 py-3 bg-surface-900/60 border border-surface-800/50 rounded-xl text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-accent-500/30 transition-all"
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={!password || busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Decrypting…
              </>
            ) : (
              "Unlock & import"
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
