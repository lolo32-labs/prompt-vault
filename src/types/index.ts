export interface PromptItem {
  id: string;
  name: string;
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
}
