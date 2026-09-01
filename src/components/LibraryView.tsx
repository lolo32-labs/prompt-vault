"use client";

import { useState, useMemo, useCallback, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { PromptItem, PromptHistoryEntry } from "@/types";
import {
  Copy,
  Trash2,
  Folder,
  FileText,
  Zap,
  ExternalLink,
  Check,
  Clock,
  Code,
  X,
  Maximize2,
  Edit3,
  Save,
  Keyboard,
  Play,
  Tag,
  Loader2,
  AlertCircle,
  AlertTriangle,
  SearchX,
  RefreshCw,
  XCircle,
  History,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn, copyToClipboard, resolveDependency } from "@/lib/utils";
import { useFocusTrap } from "@/lib/hooks";
import MarkdownPreview from "./MarkdownPreview";
import DiffView from "./DiffView";
import { scorePrompt } from "@/lib/quality";

const scoreColor = (v: number) =>
  v >= 80 ? "text-accent-400" : v >= 50 ? "text-surface-400" : "text-rose-400";
const scoreBarColor = (v: number) =>
  v >= 80 ? "bg-accent-500" : v >= 50 ? "bg-surface-500" : "bg-rose-500";

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
          {label}
        </span>
        <span className={`text-xs font-bold font-mono ${scoreColor(value)}`}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${scoreBarColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

interface LibraryViewProps {
  prompts: PromptItem[];
  onEdit?: (prompt: PromptItem) => Promise<boolean>;
  onDeleteItem?: (item: PromptItem) => Promise<boolean>;
  loading?: boolean;
  loadError?: string | null;
  totalPrompts?: number;
  filtersActive?: boolean;
  onClearFilters?: () => void;
  onTagClick?: (tag: string) => void;
  onRetryLoad?: () => void;
}

export default function LibraryView({
  prompts,
  onEdit,
  onDeleteItem,
  loading = false,
  loadError = null,
  totalPrompts = prompts.length,
  filtersActive = false,
  onClearFilters,
  onTagClick,
  onRetryLoad,
}: LibraryViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [valuesForId, setValuesForId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PromptItem | null>(null);
  const [draftTagsText, setDraftTagsText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);

  const openPrompt = (prompt: PromptItem) => {
    setSelectedPrompt(prompt);
    setIsEditing(false);
    setDraft(null);
    setDraftTagsText("");
    setEditError(null);
    setDiscardConfirmOpen(false);
    setShowHistory(false);
    setViewingVersion(null);
  };

  const variables = useMemo(() => {
    if (!selectedPrompt) return [] as string[];
    const matches = Array.from(selectedPrompt.content.matchAll(/\{\{([^}]+)\}\}/g));
    const found = matches.map((m) => m[1].trim());
    return Array.from(new Set(found));
  }, [selectedPrompt]);

  if (selectedPrompt && valuesForId !== selectedPrompt.id) {
    setValuesForId(selectedPrompt.id);
    const initialValues: Record<string, string> = {};
    variables.forEach((v) => (initialValues[v] = ""));
    setVariableValues(initialValues);
  }

  const quality = useMemo(
    () => (selectedPrompt ? scorePrompt(selectedPrompt) : null),
    [selectedPrompt]
  );

  const injectedContent = useMemo(() => {
    if (!selectedPrompt) return "";
    let content = selectedPrompt.content;
    variables.forEach((v) => {
      const value = variableValues[v] || `{{${v}}}`;
      content = content.split(`{{${v}}}`).join(value);
    });
    return content;
  }, [selectedPrompt, variables, variableValues]);

  const deferredInjected = useDeferredValue(injectedContent);

  const handleCopy = async (content: string, id: string) => {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopiedId(id);
      setCopyFailedId(null);
    } else {
      setCopyFailedId(id);
      setCopiedId(null);
    }
    setTimeout(() => {
      setCopiedId(null);
      setCopyFailedId(null);
    }, 2000);
  };

  const isDraftDirty =
    !!draft &&
    !!selectedPrompt &&
    (draft.name !== selectedPrompt.name ||
      draft.content !== selectedPrompt.content ||
      draft.type !== selectedPrompt.type ||
      [...(draft.tags ?? [])].sort().join("|") !==
        [...(selectedPrompt.tags ?? [])].sort().join("|"));

  const exitEditMode = () => {
    setIsEditing(false);
    setDraft(null);
    setDraftTagsText("");
    setEditError(null);
    setDiscardConfirmOpen(false);
  };

  const requestClose = useCallback(() => {
    if (discardConfirmOpen) {
      setDiscardConfirmOpen(false);
      return;
    }
    if (isEditing && isDraftDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    if (isEditing) {
      setIsEditing(false);
      setDraft(null);
      setDraftTagsText("");
      setEditError(null);
    }
    setSelectedPrompt(null);
  }, [discardConfirmOpen, isEditing, isDraftDirty]);

  const trapRef = useFocusTrap<HTMLDivElement>(!!selectedPrompt, requestClose);

  const startEditing = () => {
    if (!selectedPrompt) return;
    setDraft({ ...selectedPrompt, tags: [...(selectedPrompt.tags ?? [])] });
    setDraftTagsText((selectedPrompt.tags ?? []).join(", "));
    setEditError(null);
    setShowHistory(false);
    setViewingVersion(null);
    setIsEditing(true);
  };

  const restoreVersion = async (entry: PromptHistoryEntry) => {
    if (!selectedPrompt || !onEdit) return;
    setEditError(null);
    const restored: PromptItem = {
      ...selectedPrompt,
      name: entry.name,
      description: entry.description,
      content: entry.content,
      type: entry.type,
      tags: entry.tags,
    };
    const ok = await onEdit(restored);
    if (!ok) {
      setEditError("Couldn't restore this version. Please try again.");
      return;
    }
    setSelectedPrompt(restored);
    setViewingVersion(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.content.trim()) return;
    if (!onEdit) return;
    setEditError(null);
    const updated: PromptItem = {
      ...draft,
      name: draft.name.trim(),
      content: draft.content.trim(),
      tags: (() => {
        const parsed = draftTagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        return parsed.length ? parsed : undefined;
      })(),
    };
    const ok = await onEdit(updated);
    if (!ok) {
      setEditError("Couldn't save changes. Please try again.");
      return;
    }
    setSelectedPrompt(updated);
    exitEditMode();
  };

  const commitEditName = (prompt: PromptItem) => {
    if (editNameValue.trim() && editNameValue !== prompt.name && onEdit) {
      void onEdit({ ...prompt, name: editNameValue.trim() });
    }
    setEditingName(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 text-accent-400 animate-spin mx-auto" />
          <p className="text-sm text-surface-500">Loading your vault...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-24">
        <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-surface-300">Failed to load</h3>
        <p className="text-surface-500 mt-1 text-sm max-w-sm mx-auto">{loadError}</p>
        {onRetryLoad && (
          <button
            onClick={onRetryLoad}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-900/60 border border-surface-800/50 text-sm font-medium text-surface-200 hover:text-surface-50 hover:bg-surface-800/60 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        )}
      </div>
    );
  }

  const emptyVault = totalPrompts === 0;

  return (
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {prompts.map((prompt, index) => (
          <motion.div
            key={prompt.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
            onClick={() => openPrompt(prompt)}
            className="group glass-card p-5 rounded-2xl cursor-pointer relative overflow-hidden"
          >
            {/* Accent bar */}
            <div
              className={cn(
                "absolute top-0 left-0 right-0 h-0.5 transition-all duration-300",
                prompt.type === "skill"
                  ? "bg-gradient-to-r from-amber-500 to-amber-400"
                  : "bg-gradient-to-r from-accent-500 to-sky-400"
              )}
            />

            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={cn(
                    "p-2.5 rounded-xl shrink-0",
                    prompt.type === "skill"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-accent-500/10 text-accent-400"
                  )}
                >
                  {prompt.type === "skill" ? (
                    <Zap className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {editingName === prompt.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        aria-label="Prompt name"
                        className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-2 py-1 text-sm font-semibold text-surface-100 focus:outline-none focus:ring-1 focus:ring-accent-500/50"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEditName(prompt);
                          if (e.key === "Escape") setEditingName(null);
                        }}
                      />
                      <button
                        onClick={() => commitEditName(prompt)}
                        aria-label="Save name"
                        className="p-1 text-accent-400 hover:text-accent-300"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="font-semibold text-surface-100 text-sm truncate leading-tight">
                      {prompt.name}
                    </h3>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] text-surface-500 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(prompt.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingName(prompt.id);
                    setEditNameValue(prompt.name);
                  }}
                  aria-label="Rename"
                  title="Rename"
                  className="p-1.5 bg-surface-800/80 hover:bg-surface-700 rounded-lg text-surface-400 hover:text-surface-100 transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCopy(prompt.content, prompt.id);
                  }}
                  aria-label={copyFailedId === prompt.id ? "Copy failed" : "Copy content"}
                  title="Copy content"
                  className="p-1.5 bg-surface-800/80 hover:bg-surface-700 rounded-lg text-surface-400 hover:text-surface-100 transition-colors"
                >
                  {copyFailedId === prompt.id ? (
                    <XCircle className="h-3.5 w-3.5 text-rose-400" />
                  ) : copiedId === prompt.id ? (
                    <Check className="h-3.5 w-3.5 text-accent-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDeleteItem?.(prompt);
                  }}
                  aria-label="Delete"
                  title="Delete"
                  className="p-1.5 bg-surface-800/80 hover:bg-rose-500/20 rounded-lg text-surface-400 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Content Preview */}
            <div className="relative group/code">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface-950/90 z-[1] rounded-xl pointer-events-none" />
              <p className="text-xs text-surface-400 font-mono line-clamp-5 break-words bg-surface-950/60 p-3.5 rounded-xl border border-surface-800/40 leading-relaxed">
                {prompt.content}
              </p>
              <div className="absolute bottom-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-[2]">
                <Maximize2 className="h-3.5 w-3.5 text-surface-500" />
              </div>
            </div>

            {/* Footer Tags */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider",
                  prompt.type === "skill"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-sky-500/10 text-sky-400"
                )}
              >
                {prompt.type}
              </span>
              {prompt.sourceUrl && (
                <span className="px-2 py-0.5 bg-surface-800/60 rounded-md text-[10px] text-surface-500 font-medium flex items-center gap-1">
                  <ExternalLink className="h-2.5 w-2.5" />
                  GitHub
                </span>
              )}
              {prompt.tags?.map((t) => (
                <button
                  key={t}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.(t);
                  }}
                  title={`Filter by “${t}”`}
                  className="px-1.5 py-0.5 max-w-[7rem] truncate bg-surface-800/60 rounded text-[9px] text-surface-400 font-medium hover:text-accent-300 hover:bg-accent-500/10 transition-colors"
                >
                  #{t}
                </button>
              ))}
              {(() => {
                const q = scorePrompt(prompt);
                return (
                  <span
                    title={`Quality ${q.total}/100 — clarity ${q.clarity}, organization ${q.organization}, variables ${q.variables}`}
                    className={`ml-auto px-1.5 py-0.5 rounded bg-surface-900/80 border border-surface-800/50 text-[9px] font-bold font-mono ${scoreColor(q.total)}`}
                  >
                    {q.total}
                  </span>
                );
              })()}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {prompts.length === 0 && !emptyVault && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center py-24 border-2 border-dashed border-surface-800/50 rounded-2xl"
        >
          <div className="w-16 h-16 bg-surface-900/80 border border-surface-800/50 rounded-2xl flex items-center justify-center text-surface-600 mx-auto mb-5 shadow-inner">
            <SearchX className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-surface-300">No matches</h3>
          <p className="text-surface-500 mt-1 text-sm max-w-xs mx-auto">
            Nothing matches your current search or filters.
          </p>
          {filtersActive && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-500/10 border border-accent-500/25 text-sm font-medium text-accent-400 hover:bg-accent-500/20 transition-colors"
            >
              Clear search & filters
            </button>
          )}
        </motion.div>
      )}

      {emptyVault && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center py-24 border-2 border-dashed border-surface-800/50 rounded-2xl"
        >
          <div className="w-16 h-16 bg-surface-900/80 border border-surface-800/50 rounded-2xl flex items-center justify-center text-surface-600 mx-auto mb-5 shadow-inner">
            <Folder className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-surface-300">No prompts yet</h3>
          <p className="text-surface-500 mt-1 text-sm max-w-xs mx-auto">
            Create a new prompt or import from a GitHub repository to get started.
          </p>
        </motion.div>
      )}

      {/* ─── Detail Modal ───────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
      <AnimatePresence>
        {selectedPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/75 backdrop-blur-sm"
            onClick={requestClose}
          >
            <motion.div
              ref={trapRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pv-detail-title"
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full max-w-5xl max-h-[90vh] glass rounded-2xl border border-surface-700/50 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-surface-800/50 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "p-2.5 rounded-xl shrink-0",
                      selectedPrompt.type === "skill"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-accent-500/15 text-accent-400"
                    )}
                  >
                    {selectedPrompt.type === "skill" ? (
                      <Zap className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 id="pv-detail-title" className="text-xl font-bold text-surface-50 truncate">
                      {selectedPrompt.name}
                    </h2>
                    {selectedPrompt.description && (
                      <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-1">
                        {selectedPrompt.description}
                      </p>
                    )}
                    {(selectedPrompt.author || selectedPrompt.license || selectedPrompt.version) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {selectedPrompt.author && (
                          <span className="px-1.5 py-0.5 bg-surface-800/60 rounded text-[9px] text-surface-400 font-medium">
                            by {selectedPrompt.author}
                          </span>
                        )}
                        {selectedPrompt.license && (
                          <span className="px-1.5 py-0.5 bg-surface-800/60 rounded text-[9px] text-surface-400 font-medium">
                            {selectedPrompt.license}
                          </span>
                        )}
                        {selectedPrompt.version && (
                          <span className="px-1.5 py-0.5 bg-surface-800/60 rounded text-[9px] text-surface-500 font-mono">
                            v{selectedPrompt.version}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-surface-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(selectedPrompt.createdAt).toLocaleString()}
                      </span>
                      {selectedPrompt.sourceUrl && (
                        <a
                          href={selectedPrompt.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-accent-400 hover:text-accent-300 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        onClick={requestClose}
                        className="px-4 py-2 text-sm font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-800/40 rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void saveDraft()}
                        disabled={!draft || !draft.name.trim() || !draft.content.trim()}
                        className="flex items-center gap-2 px-4 py-2 gradient-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all active:scale-95"
                      >
                        <Save className="h-4 w-4" /> Save
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={startEditing}
                        aria-label="Edit this item"
                        title="Edit content"
                        className="flex items-center gap-2 px-3 py-2 bg-surface-800/60 hover:bg-surface-700/60 text-surface-300 hover:text-surface-100 rounded-xl text-sm font-medium transition-all"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void handleCopy(injectedContent, selectedPrompt.id)}
                        className="flex items-center gap-2 px-4 py-2 gradient-accent hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-all active:scale-95"
                      >
                        {copyFailedId === selectedPrompt.id ? (
                          <>
                            <XCircle className="h-4 w-4" /> Failed
                          </>
                        ) : copiedId === selectedPrompt.id ? (
                          <>
                            <Check className="h-4 w-4" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" /> Copy
                          </>
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={requestClose}
                    aria-label="Close dialog"
                    className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Unsaved-changes guard */}
              <AnimatePresence>
                {discardConfirmOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden bg-amber-500/10 border-b border-amber-500/25 shrink-0"
                  >
                    <div className="px-5 py-3 flex items-center justify-between gap-4">
                      <p className="text-xs text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        You have unsaved changes.
                      </p>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setDiscardConfirmOpen(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-surface-300 hover:text-surface-100 hover:bg-surface-800/50 transition-colors"
                        >
                          Keep editing
                        </button>
                        <button
                          onClick={() => {
                            exitEditMode();
                            setSelectedPrompt(null);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition-colors"
                        >
                          Discard changes
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-8">
                  {isEditing && draft ? (
                    <div className="space-y-5">
                      {editError && (
                        <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
                          {editError}
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                          Name
                        </label>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          aria-label="Name"
                          className="w-full px-4 py-3 bg-surface-900/60 border border-surface-800/50 rounded-xl text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500/30 transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                          Type
                        </label>
                        <div className="flex gap-3">
                          {(["prompt", "skill"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setDraft({ ...draft, type: t })}
                              aria-pressed={draft.type === t}
                              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${draft.type === t
                                ? t === "prompt"
                                  ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                : "bg-surface-900/40 border-surface-800/50 text-surface-400 hover:text-surface-200 hover:bg-surface-800/40"
                                }`}
                            >
                              {t === "prompt" ? <FileText className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                              {t === "prompt" ? "Prompt" : "Skill"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                          Tags
                        </label>
                        <input
                          type="text"
                          value={draftTagsText}
                          onChange={(e) => setDraftTagsText(e.target.value)}
                          placeholder="Comma-separated, e.g. code-review, python"
                          aria-label="Tags (comma-separated)"
                          className="w-full px-4 py-3 bg-surface-900/60 border border-surface-800/50 rounded-xl text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500/30 transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                          Content
                        </label>
                        <textarea
                          value={draft.content}
                          onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                          rows={16}
                          aria-label="Content"
                          className="w-full px-4 py-3 bg-surface-900/60 border border-surface-800/50 rounded-xl text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500/30 transition-all resize-y font-mono leading-relaxed"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      {selectedPrompt.tags && selectedPrompt.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          {selectedPrompt.tags.map((t) => (
                            <button
                              key={t}
                              onClick={() => onTagClick?.(t)}
                              title={`Filter by “${t}”`}
                              className="px-2.5 py-1 max-w-[10rem] truncate bg-surface-800/60 border border-surface-700/50 rounded-full text-[11px] text-surface-300 font-medium hover:border-accent-500/40 hover:text-accent-300 transition-colors"
                            >
                              <Tag className="inline h-3 w-3 mr-1 text-accent-400" />
                              {t}
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedPrompt.dependencies && selectedPrompt.dependencies.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-surface-600 uppercase tracking-wider">
                            Dependencies
                          </span>
                          {selectedPrompt.dependencies.map((dep) => {
                            const url = resolveDependency(selectedPrompt.sourceUrl, dep);
                            return url ? (
                              <a
                                key={dep}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                title="Open on GitHub"
                                className="px-2 py-0.5 max-w-[12rem] truncate bg-surface-900/60 border border-surface-800/50 rounded-md text-[10px] text-accent-400 font-mono hover:border-accent-500/40 transition-colors"
                              >
                                {dep}
                              </a>
                            ) : (
                              <span
                                key={dep}
                                className="px-2 py-0.5 max-w-[12rem] truncate bg-surface-900/60 border border-surface-800/50 rounded-md text-[10px] text-surface-500 font-mono"
                              >
                                {dep}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {selectedPrompt.history && selectedPrompt.history.length > 0 && (
                        <div className="flex items-center gap-1 border-b border-surface-800/40">
                          <button
                            onClick={() => {
                              setShowHistory(false);
                              setViewingVersion(null);
                            }}
                            className={cn(
                              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                              !showHistory
                                ? "border-accent-500 text-accent-400"
                                : "border-transparent text-surface-500 hover:text-surface-300"
                            )}
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => setShowHistory(true)}
                            className={cn(
                              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5",
                              showHistory
                                ? "border-accent-500 text-accent-400"
                                : "border-transparent text-surface-500 hover:text-surface-300"
                            )}
                          >
                            <History className="h-3 w-3" />
                            History ({selectedPrompt.history.length})
                          </button>
                        </div>
                      )}

                      {showHistory && selectedPrompt.history ? (
                        <div className="space-y-4">
                          {editError && (
                            <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
                              {editError}
                            </div>
                          )}
                          {viewingVersion !== null && selectedPrompt.history[viewingVersion] ? (
                            (() => {
                              const entry = selectedPrompt.history![viewingVersion];
                              return (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <button
                                      onClick={() => setViewingVersion(null)}
                                      className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-100 transition-colors"
                                    >
                                      <ArrowLeft className="h-3.5 w-3.5" />
                                      All versions
                                    </button>
                                    <button
                                      onClick={() => void restoreVersion(entry)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500/10 border border-accent-500/25 text-xs font-semibold text-accent-400 hover:bg-accent-500/20 transition-colors"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                      Restore
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-surface-500">
                                    Version from {new Date(entry.savedAt).toLocaleString()} —{" "}
                                    <span className="text-surface-300 font-medium">{entry.name}</span>
                                  </p>
                                  <DiffView
                                    oldText={entry.content}
                                    newText={selectedPrompt.content}
                                  />
                                </div>
                              );
                            })()
                          ) : (
                            <div className="space-y-2">
                              {selectedPrompt.history.map((entry, idx) => (
                                <button
                                  key={`${entry.savedAt}-${idx}`}
                                  onClick={() => setViewingVersion(idx)}
                                  className="w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-800/50 hover:border-surface-700/60 transition-all"
                                >
                                  <Clock className="h-3.5 w-3.5 text-surface-600 mt-0.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-semibold text-surface-200 truncate">
                                        {entry.name}
                                      </span>
                                      <span className="text-[10px] text-surface-600 shrink-0">
                                        {new Date(entry.savedAt).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-surface-500 font-mono line-clamp-1 mt-0.5 break-words">
                                      {entry.content}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                      {/* Playground Section */}
                      {variables.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-widest">
                            <Keyboard className="h-3.5 w-3.5 text-amber-500" />
                            Variable Playground
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {variables.map((v) => (
                              <div key={v} className="space-y-1.5">
                                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-tighter ml-1">
                                  {v}
                                </label>
                                <input
                                  type="text"
                                  placeholder={`Enter value for ${v}...`}
                                  aria-label={`Value for ${v}`}
                                  value={variableValues[v] || ""}
                                  onChange={(e) =>
                                    setVariableValues((prev) => ({ ...prev, [v]: e.target.value }))
                                  }
                                  className="w-full bg-surface-900 border border-surface-800 rounded-xl px-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Preview Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-widest">
                            <Code className="h-3.5 w-3.5 text-accent-400" />
                            {variables.length > 0 ? "Live Preview" : "Content"}
                          </div>
                          {variables.length > 0 && (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-500/80 font-medium bg-amber-500/5 px-2 py-0.5 rounded-full border border-amber-500/10">
                              <Play className="h-2.5 w-2.5" />
                              Variables Active
                            </div>
                          )}
                        </div>
                        <div className="rounded-xl overflow-hidden border border-surface-800/50 bg-surface-950/60">
                          {selectedPrompt.type === "skill" ? (
                            <div className="p-6">
                              <MarkdownPreview content={deferredInjected} />
                            </div>
                          ) : (
                            <SyntaxHighlighter
                              language="text"
                              style={atomDark}
                              customStyle={{
                                background: "transparent",
                                padding: "1.25rem",
                                fontSize: "0.8125rem",
                                lineHeight: "1.7",
                                margin: 0,
                              }}
                            >
                              {deferredInjected}
                            </SyntaxHighlighter>
                          )}
                        </div>
                      </div>

                      {quality && (
                        <div className="glass p-5 rounded-xl border border-surface-800/40">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-surface-200 flex items-center gap-2 text-sm">
                              Quality Score
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-bold font-mono ${scoreColor(quality.total)}`}
                            >
                              {quality.total}/100
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <ScoreBar label="Clarity" value={quality.clarity} />
                            <ScoreBar label="Organization" value={quality.organization} />
                            <ScoreBar label="Variables" value={quality.variables} />
                          </div>
                          <p className="text-[10px] text-surface-600 mt-3 leading-relaxed">
                            Deterministic local heuristics — no network, no LLM.
                          </p>
                        </div>
                      )}

                      {selectedPrompt.type === "skill" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="glass p-5 rounded-xl border border-surface-800/40">
                            <h4 className="font-semibold text-surface-200 mb-2 flex items-center gap-2 text-sm">
                              <Zap className="h-4 w-4 text-amber-400" />
                              Skill Manifest
                            </h4>
                            <p className="text-xs text-surface-500 leading-relaxed">
                              This asset is an agentic skill definition following the standard for
                              tool/skill specification, including system prompt segments and dependency links.
                            </p>
                          </div>
                          <div className="glass p-5 rounded-xl border border-surface-800/40">
                            <h4 className="font-semibold text-surface-200 mb-2 flex items-center gap-2 text-sm">
                              <ExternalLink className="h-4 w-4 text-accent-400" />
                              Source
                            </h4>
                            <p className="text-xs text-surface-500 leading-relaxed">
                              Origin: {selectedPrompt.sourceUrl || "Local manual entry"}.
                              Stored locally in your IndexedDB vault.
                            </p>
                          </div>
                        </div>
                      )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t border-surface-800/30 flex justify-center shrink-0">
                <p className="text-[10px] text-surface-600 font-medium tracking-widest uppercase">
                  Prompt Vault
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
