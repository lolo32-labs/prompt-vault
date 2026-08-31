import type { ScannedItem } from "@/types";

const RATE_LIMIT_MESSAGE =
  "GitHub API rate limit reached (60 requests/hour unauthenticated). Try again later or add a personal access token above.";
const TIMEOUT_MESSAGE = "GitHub request timed out. Check your connection and try again.";

const DEFAULT_TIMEOUT_MS = 15000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  init.signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError" && !init.signal?.aborted) {
      throw new Error(TIMEOUT_MESSAGE);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", onAbort);
  }
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

interface RepoRef {
  owner: string;
  repo: string;
}

/**
 * Extract `owner` and `repo` from a GitHub URL, tolerating trailing slashes,
 * `.git` suffixes, and sub-paths like `/tree/main`.
 */
export function parseRepoUrl(url: string): RepoRef | null {
  const match = url.match(/github\.com\/([^/?#]+)\/([^/?#]+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
  };
}

export async function fetchRepoDefaultBranch(
  owner: string,
  repo: string,
  token?: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders(token),
    signal,
  });
  if (response.status === 401) throw new Error("GitHub rejected the access token. Check it and try again.");
  if (response.status === 403) throw new Error(RATE_LIMIT_MESSAGE);
  if (response.status === 404)
    throw new Error("Repository not found. Check the URL is a public repository.");
  if (!response.ok) throw new Error("Failed to fetch repository metadata.");

  const data: { default_branch?: string } = await response.json();
  return data.default_branch ?? "main";
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Expects the file to start with "---" and have a closing "---".
 * Handles `key: value` pairs, quoted values, values containing colons,
 * and ignores list items / comments.
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return result;

  const lines = match[1].split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip blank lines, comments, and YAML list items (`- foo`).
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("- ")) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    if (!key || !value) continue;

    // Strip surrounding single/double quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }
  return result;
}

/**
 * Derive a human-readable skill name from the file path.
 * For a path like "skills/frontend-design/SKILL.md", returns "Frontend Design".
 * Falls back to the filename if no parent folder context exists.
 */
export function deriveNameFromPath(filePath: string): string {
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1];
  if (filename === "SKILL.md" && parts.length >= 2) {
    const folderName = parts[parts.length - 2];
    return folderName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  if (filename.endsWith(".prompt")) {
    const base = filename.replace(".prompt", "");
    return base
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return filename;
}

export function extractDependencies(content: string): string[] {
  const dependencies: string[] = [];
  // Relative path links, e.g. [assets](./assets/guide.md) or [../shared](../shared/foo.md)
  const relativePathRegex = /\[[^\]]*\]\(((?:\.{1,2}\/)[^)\s]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = relativePathRegex.exec(content)) !== null) {
    dependencies.push(match[1]);
  }
  return dependencies;
}

export function isCandidatePath(path: string): boolean {
  return path.endsWith("SKILL.md") || path.endsWith(".prompt") || path.includes("prompts/");
}

export interface RepoTreeSnapshot {
  etag?: string;
  /** path → blob sha, candidates only */
  files: Record<string, string>;
}

export type RepoTreeResult =
  | { status: "not-modified" }
  | { status: "ok"; snapshot: RepoTreeSnapshot };

/**
 * Fetch the repository tree, using `If-None-Match` when an etag is supplied.
 * A `304` response costs nothing against meaningful rate limits and signals
 * the caller that nothing changed.
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  options: { branch: string; etag?: string; token?: string; signal?: AbortSignal }
): Promise<RepoTreeResult> {
  const { branch, etag, token, signal } = options;
  const headers = githubHeaders(token);
  if (etag) headers["If-None-Match"] = etag;

  const response = await fetchWithTimeout(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers, signal }
  );
  if (response.status === 304) return { status: "not-modified" };
  if (response.status === 401) throw new Error("GitHub rejected the access token. Check it and try again.");
  if (response.status === 403) throw new Error(RATE_LIMIT_MESSAGE);
  if (response.status === 404)
    throw new Error("Repository not found. It may be private or deleted.");
  if (!response.ok) throw new Error("Failed to fetch repository structure");

  const data: {
    tree?: Array<{ type?: string; path?: string; sha?: string }>;
    truncated?: boolean;
  } = await response.json();

  if (data.truncated) {
    throw new Error("Repository is too large to scan in full. Try a repository with fewer files.");
  }

  const files: Record<string, string> = {};
  for (const item of data.tree ?? []) {
    if (item.type === "blob" && item.path && item.sha && isCandidatePath(item.path)) {
      files[item.path] = item.sha;
    }
  }

  return {
    status: "ok",
    snapshot: { etag: response.headers.get("etag") ?? undefined, files },
  };
}

function buildScannedItem(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  watchStatus?: "new" | "changed"
): ScannedItem {
  const type = path.endsWith("SKILL.md") ? ("skill" as const) : ("prompt" as const);

  let name = deriveNameFromPath(path);
  let description: string | undefined;

  if (type === "skill") {
    const frontmatter = parseFrontmatter(content);
    if (frontmatter.name) {
      name = frontmatter.name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    if (frontmatter.description) {
      description = frontmatter.description;
    }
  }

  return {
    name,
    description,
    path,
    type,
    content,
    sourceUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${path}`,
    dependencies: extractDependencies(content),
    watchStatus,
  };
}

/**
 * Fetch the contents of specific files and build ScannedItems.
 * Per-file failures are tolerated (skipped) unless the request is aborted.
 */
export async function fetchRepoFiles(
  owner: string,
  repo: string,
  branch: string,
  paths: string[],
  options: { token?: string; signal?: AbortSignal; watchStatus?: "new" | "changed" } = {}
): Promise<ScannedItem[]> {
  const { token, signal, watchStatus } = options;

  const items = await Promise.all(
    paths.map(async (path): Promise<ScannedItem | null> => {
      try {
        const contentUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
        const contentResponse = await fetchWithTimeout(contentUrl, {
          signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!contentResponse.ok) return null;
        const content = await contentResponse.text();
        return buildScannedItem(owner, repo, branch, path, content, watchStatus);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        return null;
      }
    })
  );

  return items.filter((item): item is ScannedItem => item !== null);
}

export async function scanGitHubRepo(
  url: string,
  options: { signal?: AbortSignal; token?: string } = {}
): Promise<ScannedItem[]> {
  const { signal, token } = options;
  const parsed = parseRepoUrl(url);
  if (!parsed) throw new Error("Invalid GitHub URL");
  const { owner, repo } = parsed;

  const branch = await fetchRepoDefaultBranch(owner, repo, token, signal);
  const tree = await fetchRepoTree(owner, repo, { branch, token, signal });
  if (tree.status === "not-modified") return [];

  const paths = Object.keys(tree.snapshot.files);
  return fetchRepoFiles(owner, repo, branch, paths, { token, signal });
}
