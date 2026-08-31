export interface PromptItem {
  id: string;
  name: string;
  description?: string;
  content: string;
  type: 'prompt' | 'skill';
  sourceUrl?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface ScannedItem {
  name: string;
  description?: string;
  path: string;
  type: 'prompt' | 'skill';
  content: string;
  sourceUrl?: string;
  dependencies?: string[];
  watchStatus?: 'new' | 'changed';
}

export interface WatchedRepo {
  owner: string;
  repo: string;
  branch?: string;
  etag?: string;
  lastCheckedAt?: number;
  lastError?: string;
  /** path → blob sha at last successful check */
  snapshot: Record<string, string>;
}

export type WatchStatus = 'clean' | 'changes' | 'error';

export interface WatchCheckResult {
  owner: string;
  repo: string;
  status: WatchStatus;
  added: string[];
  changed: string[];
  removed: string[];
  error?: string;
}
