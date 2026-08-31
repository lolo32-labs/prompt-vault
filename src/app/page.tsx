"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import GitHubScanner from "@/components/GitHubScanner";
import ImportSelector from "@/components/ImportSelector";
import LibraryView from "@/components/LibraryView";
import WatchList from "@/components/WatchList";
import { ScannedItem, PromptItem, WatchedRepo, WatchCheckResult } from "@/types";
import {
  getAllPrompts,
  savePrompt,
  savePrompts,
  updatePrompt,
  deletePrompt,
  listWatches,
  saveWatch,
  removeWatch,
  getWatch,
} from "@/lib/storage";
import { generateId, parseTags, duplicateKey, formatFileDate } from "@/lib/utils";
import { useDebouncedValue, useFocusTrap } from "@/lib/hooks";
import { checkWatch, checkWatches } from "@/lib/watch";
import { fetchRepoFiles } from "@/lib/scanner";
import {
  LayoutGrid,
  Plus,
  Import,
  Search,
  FolderOpen,
  Star,
  Terminal,
  ShieldCheck,
  X,
  Menu,
  Sparkles,
  FileText,
  Zap,
  ArrowRight,
  Download,
  Upload,
  Tag,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
} from "lucide-react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";

type SortKey = "newest" | "oldest" | "name";

interface Notice {
  message: string;
  type: "success" | "error";
  action?: { label: string; run: () => void | Promise<void> };
}

const SORT_STORAGE_KEY = "prompt-vault:sort";

function fetchReviewItems(
  watch: WatchedRepo,
  result: WatchCheckResult
): Promise<ScannedItem[]> {
  if (!watch.branch) return Promise.resolve([]);
  return Promise.all([
    result.added.length
      ? fetchRepoFiles(watch.owner, watch.repo, watch.branch, result.added, { watchStatus: "new" })
      : Promise.resolve([] as ScannedItem[]),
    result.changed.length
      ? fetchRepoFiles(watch.owner, watch.repo, watch.branch, result.changed, { watchStatus: "changed" })
      : Promise.resolve([] as ScannedItem[]),
  ]).then(([newItems, changedItems]) => [...newItems, ...changedItems]);
}

export default function Home() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [scannedItems, setScannedItems] = useState<ScannedItem[] | null>(null);
  const [view, setView] = useState<"library" | "import">("library");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [shortcutHint, setShortcutHint] = useState("⌘K");
  const [scannedRepo, setScannedRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [watches, setWatches] = useState<WatchedRepo[]>([]);
  const [watchResults, setWatchResults] = useState<Record<string, WatchCheckResult>>({});
  const [checkingAll, setCheckingAll] = useState(false);
  const [reviewItems, setReviewItems] = useState<Record<string, ScannedItem[]>>({});
  const [activeReviewRepo, setActiveReviewRepo] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollStartedRef = useRef(false);

  const showNotice = useCallback(
    (
      message: string,
      options?: { type?: Notice["type"]; action?: Notice["action"] }
    ) => {
      setNotice({
        message,
        type: options?.type ?? "success",
        action: options?.action,
      });
    },
    []
  );

  const loadPrompts = useCallback(async () => {
    const data = await getAllPrompts();
    setPrompts([...data].sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAllPrompts();
        if (!cancelled) setPrompts([...data].sort((a, b) => b.createdAt - a.createdAt));
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load your vault."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Collapse the sidebar on narrow screens after mount (avoids hydration mismatch).
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setSidebarOpen(false);
    }
    const mac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
    if (!mac) setShortcutHint("Ctrl K");
    try {
      const stored = localStorage.getItem(SORT_STORAGE_KEY);
      if (stored === "newest" || stored === "oldest" || stored === "name") {
        setSortBy(stored);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, sortBy);
    } catch {}
  }, [sortBy]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setView("library");
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (e.key === "Escape") {
        setShowCreateModal(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.action ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleItemsScanned = (
    items: ScannedItem[],
    repo: { owner: string; repo: string }
  ) => {
    setScannedItems(items);
    setScannedRepo(repo);
  };

  const handleScanCancel = () => {
    setScannedItems(null);
    setScannedRepo(null);
  };

  const handleImport = async (
    selected: ScannedItem[],
    options?: { replaceDuplicates?: boolean }
  ) => {
    try {
      const existing = await getAllPrompts();
      const byKey = new Map(existing.map((p) => [duplicateKey(p.type, p.name), p]));
      const toSave: PromptItem[] = [];
      let added = 0;
      let updated = 0;

      for (const item of selected) {
        const match = byKey.get(duplicateKey(item.type, item.name));
        if (match) {
          if (options?.replaceDuplicates) {
            toSave.push({
              ...match,
              content: item.content,
              sourceUrl: item.sourceUrl ?? match.sourceUrl,
              description: item.description ?? match.description,
            });
            updated++;
          }
        } else {
          toSave.push({
            id: generateId(),
            name: item.name,
            content: item.content,
            type: item.type,
            createdAt: Date.now(),
            sourceUrl:
              item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl)
                ? item.sourceUrl
                : undefined,
            description: item.description,
          });
          added++;
        }
      }

      await savePrompts(toSave);
      const skipped = selected.length - added - updated;

      setScannedItems(null);
      setScannedRepo(null);
      setView("library");
      await loadPrompts();

      if (activeReviewRepo && options?.replaceDuplicates) {
        setReviewItems((prev) => {
          const next = { ...prev };
          delete next[activeReviewRepo];
          return next;
        });
        setActiveReviewRepo(null);
      }

      const parts: string[] = [];
      if (added) parts.push(`${added} added`);
      if (updated) parts.push(`${updated} updated`);
      if (skipped) parts.push(`${skipped} duplicate${skipped === 1 ? "" : "s"} skipped`);
      showNotice(parts.length ? `Import complete: ${parts.join(", ")}.` : "Nothing to import.");
    } catch (err) {
      console.error(err);
      showNotice(
        err instanceof Error
          ? err.message
          : "Failed to save imported items. Your vault may be out of space.",
        { type: "error" }
      );
    }
  };

  const handleCreatePrompt = async (
    name: string,
    content: string,
    type: "prompt" | "skill",
    tags: string[]
  ): Promise<boolean> => {
    try {
      await savePrompt({
        id: generateId(),
        name,
        content,
        type,
        tags: tags.length ? tags : undefined,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error(err);
      showNotice("Failed to save. Your vault may be out of space.", { type: "error" });
      return false;
    }
    setShowCreateModal(false);
    await loadPrompts();
    showNotice("Prompt created.");
    return true;
  };

  const handleEditPrompt = async (prompt: PromptItem): Promise<boolean> => {
    try {
      await updatePrompt(prompt);
    } catch (err) {
      console.error(err);
      showNotice("Failed to save changes. Your vault may be out of space.", { type: "error" });
      return false;
    }
    await loadPrompts();
    return true;
  };

  const runCheckAll = useCallback(
    async (toCheck?: WatchedRepo[], opts?: { silent?: boolean }) => {
      const list = toCheck ?? watches;
      if (list.length === 0) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        showNotice("You're offline — watch checks will run next time you're online.", {
          type: "error",
        });
        return;
      }
      setCheckingAll(true);
      try {
        const results = await checkWatches(list, { staggerMs: 400 });
        const map: Record<string, WatchCheckResult> = {};
        for (const r of results) map[`${r.owner}/${r.repo}`.toLowerCase()] = r;
        setWatchResults((prev) => ({ ...prev, ...map }));
        setWatches(await listWatches());

        const changedRepos = results.filter((r) => r.status === "changes");
        if (changedRepos.length > 0) {
          const newReview: Record<string, ScannedItem[]> = {};
          for (const r of changedRepos) {
            const watch = list.find(
              (w) => w.owner === r.owner && w.repo === r.repo
            );
            if (!watch) continue;
            newReview[`${r.owner}/${r.repo}`.toLowerCase()] = await fetchReviewItems(watch, r);
          }
          setReviewItems((prev) => ({ ...prev, ...newReview }));
          const firstKey = Object.keys(newReview)[0];
          if (firstKey) setActiveReviewRepo(firstKey);

          const total = changedRepos.reduce(
            (n, r) => n + r.added.length + r.changed.length,
            0
          );
          showNotice(
            `${total} update${total === 1 ? "" : "s"} in ${changedRepos.length} watched repo${changedRepos.length === 1 ? "" : "s"}.`,
            {
              action: {
                label: "Review",
                run: async () => {
                  setView("import");
                },
              },
            }
          );
        } else if (!opts?.silent) {
          showNotice("All watched repos are up to date.");
        }
      } catch (err) {
        console.error(err);
        showNotice("Failed to check watched repos.", { type: "error" });
      } finally {
        setCheckingAll(false);
      }
    },
    [watches, showNotice]
  );

  const openReview = useCallback(
    (watch: WatchedRepo) => {
      const key = `${watch.owner}/${watch.repo}`.toLowerCase();
      if (reviewItems[key]) {
        setActiveReviewRepo(key);
        setView("import");
        return;
      }
      void (async () => {
        try {
          const result = await checkWatch(watch, {});
          setWatchResults((prev) => ({ ...prev, [key]: result }));
          setWatches(await listWatches());
          if (result.status === "changes") {
            const items = await fetchReviewItems(watch, result);
            setReviewItems((prev) => ({ ...prev, [key]: items }));
            setActiveReviewRepo(key);
            setView("import");
          } else if (result.status === "error") {
            showNotice(result.error ?? "Failed to check this repo.", { type: "error" });
          } else {
            showNotice(`${watch.owner}/${watch.repo} is up to date.`);
          }
        } catch (err) {
          console.error(err);
          showNotice("Failed to check this repo.", { type: "error" });
        }
      })();
    },
    [reviewItems, showNotice]
  );

  const watchCurrentRepo = async () => {
    if (!scannedRepo || !scannedRepo.owner) return;
    try {
      await saveWatch({ owner: scannedRepo.owner, repo: scannedRepo.repo, snapshot: {} });
      const stored = await getWatch(scannedRepo.owner, scannedRepo.repo);
      if (stored) {
        const result = await checkWatch(stored, {});
        setWatchResults((prev) => ({
          ...prev,
          [`${stored.owner}/${stored.repo}`.toLowerCase()]: result,
        }));
      }
      setWatches(await listWatches());
      showNotice(`Watching ${scannedRepo.owner}/${scannedRepo.repo} — updates appear here.`);
    } catch (err) {
      console.error(err);
      showNotice("Failed to watch this repo.", { type: "error" });
    }
  };

  const unwatchRepo = async (watch: WatchedRepo) => {
    try {
      await removeWatch(watch.owner, watch.repo);
      setWatches(await listWatches());
      const key = `${watch.owner}/${watch.repo}`.toLowerCase();
      setReviewItems((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      showNotice(`Stopped watching ${watch.owner}/${watch.repo}.`);
    } catch {
      showNotice("Failed to remove this watch.", { type: "error" });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await listWatches();
        if (cancelled) return;
        setWatches(loaded);
        if (
          loaded.length > 0 &&
          !pollStartedRef.current &&
          typeof navigator !== "undefined" &&
          navigator.onLine
        ) {
          pollStartedRef.current = true;
          void runCheckAll(loaded, { silent: true });
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteWithUndo = useCallback(
    async (item: PromptItem): Promise<boolean> => {
      try {
        await deletePrompt(item.id);
      } catch (err) {
        console.error(err);
        showNotice("Failed to delete this item.", { type: "error" });
        return false;
      }
      await loadPrompts();
      showNotice(`Deleted “${item.name}”`, {
        action: {
          label: "Undo",
          run: async () => {
            try {
              await savePrompt(item);
              await loadPrompts();
              showNotice(`Restored “${item.name}”.`);
            } catch (err) {
              console.error(err);
              showNotice("Failed to restore this item.", { type: "error" });
            }
          },
        },
      });
      return true;
    },
    [loadPrompts, showNotice]
  );

  const handleExport = () => {
    try {
      const bundle = {
        version: "1.1.0",
        exportedAt: new Date().toISOString(),
        items: prompts,
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prompt-vault-${formatFileDate(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotice(`Exported ${prompts.length} item${prompts.length === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error(err);
      showNotice("Export failed.", { type: "error" });
    }
  };

  const handleImportJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { items?: PromptItem[] } | PromptItem[];
      const rawItems = Array.isArray(parsed) ? parsed : parsed.items;

      if (!Array.isArray(rawItems)) {
        throw new Error("Invalid bundle: expected an array of items.");
      }

      const valid = rawItems.filter(
        (i): i is PromptItem =>
          !!i &&
          typeof i.id === "string" &&
          typeof i.name === "string" &&
          typeof i.content === "string"
      );

      const sanitized = valid.map((i) => ({
        ...i,
        tags: Array.isArray(i.tags) ? i.tags.filter((t) => typeof t === "string") : undefined,
        sourceUrl:
          typeof i.sourceUrl === "string" && /^https?:\/\//i.test(i.sourceUrl)
            ? i.sourceUrl
            : undefined,
        createdAt: typeof i.createdAt === "number" ? i.createdAt : Date.now(),
      }));

      const existing = await getAllPrompts();
      const existingIds = new Set(existing.map((p) => p.id));
      const added = sanitized.filter((i) => !existingIds.has(i.id)).length;
      const updated = sanitized.length - added;

      await savePrompts(sanitized);
      await loadPrompts();
      showNotice(
        sanitized.length
          ? `Bundle imported: ${added} added${updated > 0 ? `, ${updated} updated` : ""}.`
          : "No valid items found in bundle."
      );
    } catch (err) {
      console.error(err);
      showNotice(
        err instanceof Error ? err.message : "Failed to import bundle.",
        { type: "error" }
      );
    }
  };

  const debouncedQuery = useDebouncedValue(searchQuery, 200);

  const searchIndex = useMemo(() => {
    return prompts.map((p) => ({
      id: p.id,
      haystack: `${p.name} ${p.content} ${(p.tags ?? []).join(" ")}`.toLowerCase(),
    }));
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();
    let base =
      !query
        ? prompts.filter((p) => activeCategory === "all" || p.type === activeCategory)
        : (() => {
            const matchingIds = new Set(
              searchIndex
                .filter((entry) => entry.haystack.includes(query))
                .map((entry) => entry.id)
            );
            return prompts.filter(
              (p) => matchingIds.has(p.id) && (activeCategory === "all" || p.type === activeCategory)
            );
          })();

    base = [...base];
    if (sortBy === "oldest") base.sort((a, b) => a.createdAt - b.createdAt);
    else if (sortBy === "name") base.sort((a, b) => a.name.localeCompare(b.name));
    else base.sort((a, b) => b.createdAt - a.createdAt);
    return base;
  }, [prompts, searchIndex, debouncedQuery, activeCategory, sortBy]);

  const skillCount = prompts.filter((p) => p.type === "skill").length;
  const promptCount = prompts.filter((p) => p.type === "prompt").length;
  const filtersActive = debouncedQuery.trim() !== "" || activeCategory !== "all";
  const existingKeys = useMemoExistingKeys(prompts);

  const clearFilters = () => {
    setSearchQuery("");
    setActiveCategory("all");
  };

  const navItems = [
    { id: "library" as const, label: "Library", icon: LayoutGrid },
    { id: "import" as const, label: "Import", icon: Import },
  ];

  const categoryItems = [
    { id: "all", label: "All Prompts", icon: FolderOpen, count: prompts.length },
    { id: "skill", label: "Skills", icon: Star, count: skillCount },
    { id: "prompt", label: "Prompts", icon: Terminal, count: promptCount },
  ];

  const closeSidebarIfNarrow = () => {
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setSidebarOpen(false);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden font-sans">
      <MotionConfig reducedMotion="user">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar ─────────────────────────────── */}
      <aside
        className={`fixed lg:relative z-40 w-72 h-full flex flex-col bg-surface-950 border-r border-surface-800/50 transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-20"
          }`}
      >
        {/* Brand */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 gradient-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent-500/20 shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className={`${!sidebarOpen ? "lg:hidden" : ""}`}>
            <h1 className="font-bold tracking-tight text-lg leading-tight text-surface-50">
              Prompt Vault
            </h1>
            <span className="text-[10px] uppercase tracking-widest text-accent-400 font-semibold">
              Engineering Tool
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-6 overflow-y-auto">
          <div>
            <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-widest px-3 mb-2">
              Navigation
            </p>
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView(item.id);
                      closeSidebarIfNarrow();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive
                      ? "bg-accent-500/10 text-accent-400 border border-accent-500/20"
                      : "text-surface-400 hover:text-surface-100 hover:bg-surface-800/40 border border-transparent"
                      }`}
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-accent-400" : "text-surface-500 group-hover:text-surface-300"}`} />
                    <span className={`${!sidebarOpen ? "lg:hidden" : ""}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-widest px-3 mb-2">
              Collections
            </p>
            <div className="space-y-1">
              {categoryItems.map((item) => {
                const isActive = activeCategory === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveCategory(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive
                      ? "text-accent-400"
                      : "text-surface-400 hover:text-surface-100 hover:bg-surface-800/40"
                      }`}
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-accent-400" : "text-surface-500 group-hover:text-surface-300"}`} />
                    <span className={`flex-1 text-left ${!sidebarOpen ? "lg:hidden" : ""}`}>{item.label}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive
                        ? "bg-accent-500/15 text-accent-400"
                        : "bg-surface-800 text-surface-500"
                        } ${!sidebarOpen ? "lg:hidden" : ""}`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <WatchList
            watches={watches}
            results={watchResults}
            checking={checkingAll}
            onCheckAll={() => void runCheckAll()}
            onOpenReview={(w) => openReview(w)}
            onRemove={(w) => void unwatchRepo(w)}
          />
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-surface-800/50 space-y-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-800/50 hover:bg-surface-800/60 hover:border-surface-700/50 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center text-white shrink-0">
              <Plus className="h-4 w-4" />
            </div>
            <div className={`flex-1 text-left min-w-0 ${!sidebarOpen ? "lg:hidden" : ""}`}>
              <p className="text-xs font-semibold text-surface-200 group-hover:text-white transition-colors">
                Create Prompt
              </p>
              <p className="text-[10px] text-surface-500">Add manually</p>
            </div>
          </button>

          <div className={`flex gap-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>
            <button
              onClick={handleExport}
              disabled={prompts.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-surface-900/60 border border-surface-800/50 text-xs font-medium text-surface-300 hover:text-surface-100 hover:bg-surface-800/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export as JSON bundle"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-surface-900/60 border border-surface-800/50 text-xs font-medium text-surface-300 hover:text-surface-100 hover:bg-surface-800/60 transition-all"
              title="Import JSON bundle"
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportJson(file);
              e.target.value = "";
            }}
          />
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────── */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-surface-800/50 flex items-center justify-between px-4 md:px-8 glass z-10 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
              className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 rounded-lg transition-colors lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex-1 max-w-lg relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search prompts..."
                aria-label="Search prompts"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-900/60 border border-surface-800/50 rounded-xl py-2 pl-10 pr-20 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500/30 transition-all"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-800/80 border border-surface-700/50 text-[10px] text-surface-400 font-mono whitespace-nowrap">
                {shortcutHint}
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {prompts.length > 0 && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-900/60 border border-surface-800/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
                  <span className="text-xs text-surface-400 font-medium">
                    {prompts.length} {prompts.length === 1 ? "item" : "items"}
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 gradient-accent hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-accent-500/20"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Entry</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto ambient-glow dot-grid">
          <div className="relative z-10 p-4 md:p-8">
            <AnimatePresence mode="wait">
              {view === "library" ? (
                <motion.div
                  key="library"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-8"
                >
                  {/* Library Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-surface-800/30">
                    <div>
                      <div className="flex items-center gap-2 text-accent-400 text-xs font-semibold uppercase tracking-widest mb-2">
                        <Sparkles className="h-3 w-3" />
                        Your Collection
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-surface-50">
                        Prompt Library
                      </h2>
                      <p className="text-surface-400 mt-1 max-w-lg text-sm">
                        Manage and organize your LLM prompts and agentic skill definitions.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center">
                        <ArrowUpDown className="absolute left-2.5 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as SortKey)}
                          aria-label="Sort items"
                          className="appearance-none pl-8 pr-7 py-2 rounded-lg bg-surface-900/60 border border-surface-800/50 text-xs text-surface-300 hover:text-surface-100 focus:outline-none focus:ring-2 focus:ring-accent-500/30 cursor-pointer transition-colors"
                        >
                          <option value="newest">Newest first</option>
                          <option value="oldest">Oldest first</option>
                          <option value="name">Name A–Z</option>
                        </select>
                      </label>
                      {skillCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-semibold">
                          <Zap className="h-3 w-3" />
                          {skillCount} {skillCount === 1 ? "Skill" : "Skills"}
                        </div>
                      )}
                      {promptCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-full text-sky-400 text-xs font-semibold">
                          <FileText className="h-3 w-3" />
                          {promptCount} {promptCount === 1 ? "Prompt" : "Prompts"}
                        </div>
                      )}
                    </div>
                  </div>

                  <LibraryView
                    prompts={filteredPrompts}
                    onEdit={handleEditPrompt}
                    onDeleteItem={handleDeleteWithUndo}
                    loading={loading}
                    loadError={loadError}
                    totalPrompts={prompts.length}
                    filtersActive={filtersActive}
                    onClearFilters={clearFilters}
                    onTagClick={(tag) => {
                      setSearchQuery(tag);
                      setActiveCategory("all");
                    }}
                    onRetryLoad={
                      loadError
                        ? () => {
                            setLoadError(null);
                            setReloadKey((k) => k + 1);
                          }
                        : undefined
                    }
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="import"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-8 flex flex-col items-center"
                >
                  {/* Import Header */}
                  <div className="text-center max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-500/10 border border-accent-500/20 rounded-full text-accent-400 text-[10px] font-semibold uppercase tracking-widest mb-4">
                      <Sparkles className="h-3 w-3" />
                      Repository Sync
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-surface-50 mb-3">
                      Import from GitHub
                    </h2>
                    <p className="text-surface-400 text-base">
                      Connect to a public repository to discover and import prompt files and skill definitions.
                    </p>
                  </div>

                  <div className="w-full max-w-4xl">
                    {activeReviewRepo && reviewItems[activeReviewRepo] ? (
                      (() => {
                        const [owner, repo] = activeReviewRepo.split("/");
                        return (
                          <ImportSelector
                            items={reviewItems[activeReviewRepo]}
                            onImport={handleImport}
                            onCancel={() => setActiveReviewRepo(null)}
                            existingKeys={existingKeys}
                            repo={{ owner, repo }}
                            watched
                          />
                        );
                      })()
                    ) : !scannedItems ? (
                      <GitHubScanner onItemsScanned={handleItemsScanned} />
                    ) : (
                      <ImportSelector
                        items={scannedItems}
                        onImport={handleImport}
                        onCancel={handleScanCancel}
                        existingKeys={existingKeys}
                        repo={scannedRepo ?? undefined}
                        watched={
                          !!scannedRepo &&
                          watches.some(
                            (w) =>
                              w.owner === scannedRepo.owner && w.repo === scannedRepo.repo
                          )
                        }
                        onWatch={() => watchCurrentRepo()}
                      />
                    )}
                  </div>

                  {/* Feature cards */}
                  <div className="glass rounded-2xl p-6 md:p-8 max-w-2xl mx-auto w-full gradient-border">
                    <h3 className="font-bold text-surface-100 flex items-center gap-2 mb-5 text-lg">
                      <Sparkles className="h-5 w-5 text-accent-400" />
                      Extraction Engine
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {[
                        {
                          title: "SKILL.md Detection",
                          desc: "Detects Claude/OpenClaw compliant skill definitions with dependency mapping.",
                        },
                        {
                          title: "File Ingestion",
                          desc: "Automatic detection of .prompt and .ai manifest files in repository trees.",
                        },
                        {
                          title: "Dependency Graph",
                          desc: "Identifies linked assets and bundles referenced files together.",
                        },
                        {
                          title: "Local Storage",
                          desc: "All data is stored locally via IndexedDB. No server-side storage.",
                        },
                      ].map((feat) => (
                        <div key={feat.title} className="space-y-1.5">
                          <p className="text-sm font-semibold text-surface-200">{feat.title}</p>
                          <p className="text-xs text-surface-500 leading-relaxed">{feat.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ─── Notice Toast ─────────────────────────── */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="status"
            className={`fixed bottom-6 right-6 z-[70] flex items-center gap-3 max-w-md pl-4 pr-2 py-3 rounded-xl glass shadow-2xl ${
              notice.type === "error" ? "border border-rose-500/40" : "border border-accent-500/30"
            }`}
          >
            {notice.type === "error" ? (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-accent-400 shrink-0" />
            )}
            <p className="text-sm text-surface-100">{notice.message}</p>
            {notice.action && (
              <button
                onClick={() => {
                  void notice.action!.run();
                  setNotice(null);
                }}
                className="ml-auto shrink-0 px-3 py-1 rounded-lg text-xs font-semibold text-accent-300 hover:bg-accent-500/15 transition-colors"
              >
                {notice.action.label}
              </button>
            )}
            <button
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
              className={`p-1.5 rounded transition-colors ${
                notice.action ? "" : "ml-auto"
              } text-surface-400 hover:text-surface-100`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Create Prompt Modal ──────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <CreatePromptModal
            onSubmit={handleCreatePrompt}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </AnimatePresence>
      </MotionConfig>
    </main>
  );
}

function useMemoExistingKeys(prompts: PromptItem[]): Set<string> {
  return useMemo(() => new Set(prompts.map((p) => duplicateKey(p.type, p.name))), [prompts]);
}


/* ─── Create Prompt Modal Component ───────────── */

function CreatePromptModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (
    name: string,
    content: string,
    type: "prompt" | "skill",
    tags: string[]
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"prompt" | "skill">("prompt");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const hasInput = name.trim() !== "" || content.trim() !== "" || tags.trim() !== "";

  const requestClose = useCallback(() => {
    if (hasInput && !discardConfirmOpen) {
      setDiscardConfirmOpen(true);
      return;
    }
    setDiscardConfirmOpen(false);
    onClose();
  }, [hasInput, discardConfirmOpen, onClose]);

  const trapRef = useFocusTrap<HTMLDivElement>(true, requestClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onSubmit(name.trim(), content.trim(), type, parseTags(tags));
      if (!ok) {
        setError("Couldn't save your prompt. Please try again.");
        setSubmitting(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <motion.div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pv-create-title"
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-xl glass rounded-2xl border border-surface-700/50 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-accent rounded-xl flex items-center justify-center text-white">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 id="pv-create-title" className="text-lg font-bold text-surface-50">
                Create Prompt
              </h3>
              <p className="text-xs text-surface-500">Add a new prompt to your vault</p>
            </div>
          </div>
          <button
            onClick={requestClose}
            aria-label="Close dialog"
            className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <AnimatePresence>
          {discardConfirmOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden bg-amber-500/10 border-y border-amber-500/25"
            >
              <div className="px-6 py-3 flex items-center justify-between gap-4">
                <p className="text-xs text-amber-300">
                  Close without saving? Your input will be lost.
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
                      setDiscardConfirmOpen(false);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Code Review Assistant"
              autoFocus
              aria-label="Name"
              className="w-full px-4 py-3 bg-surface-900/60 border border-surface-800/50 rounded-xl text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500/30 transition-all"
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
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${type === t
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
            <div className="relative">
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-600" />
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. code-review, python, production"
                aria-label="Tags (comma-separated)"
                className="w-full px-4 py-3 pl-11 bg-surface-900/60 border border-surface-800/50 rounded-xl text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500/30 transition-all"
              />
            </div>
            <p className="text-[10px] text-surface-500">Comma-separated.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your prompt content..."
              rows={8}
              aria-label="Content"
              className="w-full px-4 py-3 bg-surface-900/60 border border-surface-800/50 rounded-xl text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500/30 transition-all resize-none font-mono leading-relaxed"
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={requestClose}
              className="px-5 py-2.5 text-sm font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-800/40 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !content.trim() || submitting}
              className="flex items-center gap-2 px-6 py-2.5 gradient-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-accent-500/20"
            >
              {submitting ? (
                "Saving..."
              ) : (
                <>
                  Create
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
