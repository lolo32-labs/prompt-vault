"use client";

import { useState } from "react";
import { Settings, X, Plus, Globe, ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { BridgeSettings } from "@/types";
import { normalizeOrigin } from "@/lib/bridge";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/hooks";

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors shrink-0",
        checked ? "bg-accent-500" : "bg-surface-700",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  );
}

interface AgentBridgeProps {
  settings: BridgeSettings;
  onChange: (next: BridgeSettings) => void | Promise<void>;
}

export default function AgentBridge({ settings, onChange }: AgentBridgeProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between px-3 mb-2">
        <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-widest">
          Agent Bridge
        </p>
        <button
          onClick={() => setModalOpen(true)}
          aria-label="Agent bridge settings"
          title="Agent bridge settings"
          className="p-1 text-surface-500 hover:text-accent-400 transition-colors"
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>

      <div className="flex items-center gap-2.5 px-3 py-1">
        <Toggle
          checked={settings.bridgeEnabled}
          onChange={(v) => void onChange({ ...settings, bridgeEnabled: v })}
          label="Enable agent bridge"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-surface-300">
            {settings.bridgeEnabled ? "Listening" : "Off"}
          </p>
          <p className="text-[10px] text-surface-600 truncate">
            {settings.bridgeEnabled
              ? `${settings.allowedOrigins.length} origin${settings.allowedOrigins.length === 1 ? "" : "s"} allowed`
              : "Let trusted agents query your vault"}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <BridgeSettingsModal
            settings={settings}
            onChange={onChange}
            onClose={() => setModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BridgeSettingsModal({
  settings,
  onChange,
  onClose,
}: AgentBridgeProps & { onClose: () => void }) {
  const [originInput, setOriginInput] = useState("");
  const [originError, setOriginError] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);

  const addOrigin = () => {
    const normalized = normalizeOrigin(originInput);
    if (!normalized) {
      setOriginError("Enter a valid http(s) origin, e.g. https://my-agent.example");
      return;
    }
    if (settings.allowedOrigins.includes(normalized)) {
      setOriginError("This origin is already allowed.");
      return;
    }
    setOriginError(null);
    setOriginInput("");
    void onChange({
      ...settings,
      allowedOrigins: [...settings.allowedOrigins, normalized],
    });
  };

  const removeOrigin = (origin: string) => {
    void onChange({
      ...settings,
      allowedOrigins: settings.allowedOrigins.filter((o) => o !== origin),
    });
  };

  const patchPermissions = (patch: Partial<BridgeSettings["permissions"]>) =>
    void onChange({ ...settings, permissions: { ...settings.permissions, ...patch } });

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
        aria-labelledby="pv-bridge-title"
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-lg glass rounded-2xl border border-surface-700/50 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-800/50">
          <div>
            <h3 id="pv-bridge-title" className="text-lg font-bold text-surface-50">
              Agent Bridge
            </h3>
            <p className="text-xs text-surface-500">
              Let browser-based agents query your vault — read-only.
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

        <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Master toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-surface-200">Enable bridge</p>
              <p className="text-[11px] text-surface-500">
                Off means the bridge doesn&apos;t exist — no listener, no responses.
              </p>
            </div>
            <Toggle
              checked={settings.bridgeEnabled}
              onChange={(v) => void onChange({ ...settings, bridgeEnabled: v })}
              label="Enable agent bridge"
            />
          </div>

          {/* Permissions */}
          <div className={cn("space-y-3", !settings.bridgeEnabled && "opacity-50")}>
            <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-widest">
              Permissions
            </p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-surface-200">List items</p>
                <p className="text-[11px] text-surface-500">Names and metadata — never content.</p>
              </div>
              <Toggle
                checked={settings.permissions.list}
                onChange={(v) => patchPermissions({ list: v })}
                disabled={!settings.bridgeEnabled}
                label="Allow list action"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-surface-200">Get item content</p>
                <p className="text-[11px] text-surface-500">
                  Fetch a single item by id (rate limited).
                </p>
              </div>
              <Toggle
                checked={settings.permissions.get}
                onChange={(v) => patchPermissions({ get: v })}
                disabled={!settings.bridgeEnabled}
                label="Allow get action"
              />
            </div>
          </div>

          {/* Origins */}
          <div className={cn("space-y-3", !settings.bridgeEnabled && "opacity-50")}>
            <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-widest">
              Allowed origins
            </p>
            {settings.allowedOrigins.length === 0 ? (
              <p className="text-[11px] text-surface-600">
                No origins allowed yet — the bridge will stay silent.
              </p>
            ) : (
              <div className="space-y-1.5">
                {settings.allowedOrigins.map((origin) => (
                  <div
                    key={origin}
                    className="flex items-center gap-2 px-3 py-2 bg-surface-900/60 border border-surface-800/50 rounded-lg"
                  >
                    <Globe className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                    <span className="flex-1 text-xs text-surface-200 font-mono truncate">
                      {origin}
                    </span>
                    <button
                      onClick={() => removeOrigin(origin)}
                      aria-label={`Remove ${origin}`}
                      className="p-1 text-surface-500 hover:text-rose-400 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={originInput}
                onChange={(e) => {
                  setOriginInput(e.target.value);
                  setOriginError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOrigin();
                  }
                }}
                placeholder="https://my-agent.example"
                disabled={!settings.bridgeEnabled}
                aria-label="Origin to allow"
                className="flex-1 px-3 py-2 bg-surface-900/60 border border-surface-800/50 rounded-lg text-xs text-surface-100 placeholder:text-surface-600 focus:outline-none focus:ring-1 focus:ring-accent-500/40 transition-all disabled:opacity-50"
              />
              <button
                onClick={addOrigin}
                disabled={!settings.bridgeEnabled || !originInput.trim()}
                aria-label="Add origin"
                className="px-3 py-2 rounded-lg bg-surface-800/60 border border-surface-700/50 text-surface-300 hover:text-surface-100 hover:bg-surface-700/60 disabled:opacity-40 transition-all flex items-center gap-1.5 text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                Allow
              </button>
            </div>
            {originError && <p className="text-[11px] text-rose-400">{originError}</p>}
          </div>

          <div className="pt-1 border-t border-surface-800/40 flex items-center justify-between gap-4">
            <p className="text-[10px] text-surface-600 leading-relaxed">
              Read-only. Mutations and bulk export are impossible by design.
            </p>
            <a
              href="https://github.com/lolo32-labs/prompt-vault/blob/main/docs/query-api.md"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center gap-1 text-[10px] text-accent-400 hover:text-accent-300"
            >
              Protocol docs
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
