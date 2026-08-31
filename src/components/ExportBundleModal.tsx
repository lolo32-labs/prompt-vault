"use client";

import { useState } from "react";
import { X, FileJson, Lock, Download } from "lucide-react";
import { motion } from "framer-motion";
import { useFocusTrap } from "@/lib/hooks";

interface ExportBundleModalProps {
  itemCount: number;
  onClose: () => void;
  onExportPlain: () => void | Promise<void>;
  onExportEncrypted: (password: string) => void | Promise<void>;
}

export default function ExportBundleModal({
  itemCount,
  onClose,
  onExportPlain,
  onExportEncrypted,
}: ExportBundleModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);

  const exportEncrypted = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onExportEncrypted(password);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-surface-900/60 border border-surface-800/50 rounded-xl text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-accent-500/30 transition-all";

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
        aria-labelledby="pv-export-title"
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-md glass rounded-2xl border border-surface-700/50 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-surface-800/50">
          <div>
            <h3 id="pv-export-title" className="text-lg font-bold text-surface-50">
              Export bundle
            </h3>
            <p className="text-xs text-surface-500">
              {itemCount} item{itemCount === 1 ? "" : "s"} · history not included
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Plain JSON */}
          <button
            onClick={() => void onExportPlain()}
            className="w-full text-left flex items-start gap-3 p-4 rounded-xl border border-surface-800/50 bg-surface-900/40 hover:bg-surface-800/50 hover:border-surface-700/60 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
              <FileJson className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-surface-100">Plain JSON</p>
              <p className="text-[11px] text-surface-500 leading-relaxed">
                Readable bundle for backup and re-import. Anyone with the file can read it.
              </p>
            </div>
          </button>

          {/* Encrypted */}
          <div className="p-4 rounded-xl border border-surface-800/50 bg-surface-900/40 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
                <Lock className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-surface-100">Password-protected</p>
                <p className="text-[11px] text-surface-500 leading-relaxed">
                  AES-256-GCM, derived with PBKDF2. Recipients need the password to import.
                </p>
              </div>
            </div>
            <div className="space-y-2 pl-12">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Password (min 8 characters)"
                autoComplete="new-password"
                aria-label="Encryption password"
                className={inputClass}
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void exportEncrypted();
                }}
                placeholder="Confirm password"
                autoComplete="new-password"
                aria-label="Confirm password"
                className={inputClass}
              />
              {error && <p className="text-[11px] text-rose-400">{error}</p>}
              <button
                onClick={() => void exportEncrypted()}
                disabled={busy || password.length < 8 || password !== confirm}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                {busy ? "Encrypting…" : "Export .pvault"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
