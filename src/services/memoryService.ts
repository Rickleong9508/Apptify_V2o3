/**
 * memoryService — persistent conversation memory for the BingGo assistant.
 *
 * Turns are stored in `localStorage` (`binggo_memory_v1`) and recalled either
 * semantically (embeddings + cosine similarity, via `aiService.embeddings`) or,
 * when embeddings are unavailable, by a case-insensitive keyword scan. Every
 * public method is safe during SSR and in restricted storage contexts (Safari
 * private mode, blocked cookies): reads degrade to an empty memory and writes
 * fail silently rather than throwing.
 *
 * Storage discipline:
 *  - hard cap of 400 turns (newest kept);
 *  - `images` data URLs are dropped from any turn older than the newest 12,
 *    because base64 screenshots would otherwise blow the ~5MB quota;
 *  - cached embeddings are rounded and shed progressively if a write hits the
 *    quota, so a large memory can never make the service unusable.
 */

import { aiService, type AIProvider } from './aiService';

export type BingGoRole = 'user' | 'assistant';

export interface BingGoTurn {
  id: string;
  role: BingGoRole;
  text: string;
  at: number;              // epoch ms
  /** Data URLs of any images the user attached to this turn. */
  images?: string[];
  /** Short tag of what the assistant did, e.g. an executed intent id. */
  action?: string;
}

export interface RecalledTurn extends BingGoTurn { score: number; }

export interface MemoryOptions {
  /** Provider + model + key used for embeddings. */
  provider?: string;
  model?: string;
  apiKey?: string;
}

export const MEMORY_STORAGE_KEY = 'binggo_memory_v1';

const MAX_TURNS = 400;
/** Turns newer than this keep their image data URLs. */
const IMAGE_RETENTION = 12;
const DEFAULT_K = 6;
const DEFAULT_MAX_CHARS = 6000;
/** Texts per embeddings request, keeping payloads modest. */
const EMBED_BATCH = 24;

/** A stored turn may carry its cached embedding. */
type StoredTurn = BingGoTurn & { embedding?: number[] };

/* ------------------------------------------------------------------ *
 * Storage plumbing (SSR + quota safe)
 * ------------------------------------------------------------------ */

let cache: StoredTurn[] | null = null;

const storage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    // Accessing localStorage itself throws when storage is blocked.
    return null;
  }
};

const createId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the manual id */
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStoredTurn = (value: unknown): StoredTurn | null => {
  if (!isRecord(value)) return null;
  const role = value.role;
  if (role !== 'user' && role !== 'assistant') return null;
  if (typeof value.text !== 'string') return null;
  if (typeof value.id !== 'string' || !value.id) return null;

  const turn: StoredTurn = {
    id: value.id,
    role,
    text: value.text,
    at: typeof value.at === 'number' && Number.isFinite(value.at) ? value.at : Date.now(),
  };
  if (Array.isArray(value.images)) {
    const images = value.images.filter((img): img is string => typeof img === 'string');
    if (images.length) turn.images = images;
  }
  if (typeof value.action === 'string' && value.action) turn.action = value.action;
  if (Array.isArray(value.embedding)) {
    const embedding = value.embedding.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    if (embedding.length) turn.embedding = embedding;
  }
  return turn;
};

/** Accepts both the current `{ version, turns }` envelope and a bare array. */
const parseStored = (raw: string | null): StoredTurn[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.turns)
        ? parsed.turns
        : [];
    return list.map(toStoredTurn).filter((turn): turn is StoredTurn => turn !== null);
  } catch {
    return [];
  }
};

/** Cap the history and forget old (large) image payloads. */
const prune = (turns: StoredTurn[]): StoredTurn[] => {
  const capped = turns.slice(-MAX_TURNS);
  const imageCutoff = capped.length - IMAGE_RETENTION;
  return capped.map((turn, index) => {
    if (turn.images?.length && index < imageCutoff) {
      const { images: _dropped, ...rest } = turn;
      return rest;
    }
    return turn;
  });
};

const stripEmbedding = (turn: StoredTurn): StoredTurn => {
  const next: StoredTurn = { ...turn };
  delete next.embedding;
  return next;
};

const persist = (turns: StoredTurn[]): StoredTurn[] => {
  const pruned = prune(turns);
  const store = storage();
  if (!store) return pruned;

  const write = (value: StoredTurn[]) => {
    store.setItem(MEMORY_STORAGE_KEY, JSON.stringify({ version: 1, turns: value }));
  };

  try {
    write(pruned);
    return pruned;
  } catch {
    // Likely QuotaExceededError: shed cached embeddings, oldest first, and retry.
    const light: StoredTurn[] = pruned.map((turn, index) =>
      turn.embedding && index < pruned.length - 50 ? stripEmbedding(turn) : turn,
    );
    try {
      write(light);
      return light;
    } catch {
      const bare = light.map(stripEmbedding);
      try {
        write(bare);
      } catch {
        /* storage is unusable; keep the in-memory copy only */
      }
      return bare;
    }
  }
};

const readAll = (): StoredTurn[] => {
  if (cache) return cache;
  const store = storage();
  cache = store ? prune(parseStored(store.getItem(MEMORY_STORAGE_KEY))) : [];
  return cache;
};

const commit = (turns: StoredTurn[]): StoredTurn[] => {
  cache = persist(turns);
  return cache;
};

/** Public reads hand out copies so callers cannot mutate the cache. */
const cloneTurn = (turn: StoredTurn): StoredTurn => ({
  ...turn,
  ...(turn.images ? { images: [...turn.images] } : {}),
  ...(turn.embedding ? { embedding: [...turn.embedding] } : {}),
});

/* ------------------------------------------------------------------ *
 * Recall helpers
 * ------------------------------------------------------------------ */

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const countOccurrences = (haystack: string, needle: string): number => {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) return count;
    count += 1;
    from = index + needle.length;
  }
};

/** Fallback ranking: substring hits, weighted so the full query counts most. */
const keywordSearch = (turns: StoredTurn[], query: string, limit: number): RecalledTurn[] => {
  const needle = query.toLowerCase();
  const tokens = needle.split(/[\s,.;:!?\u3002\uFF0C\uFF01\uFF1F\uFF1B\uFF1A\u3001]+/).filter((t) => t.length >= 2);

  const scored = turns
    .map((turn) => {
      const haystack = turn.text.toLowerCase();
      let score = countOccurrences(haystack, needle) * 3;
      for (const token of tokens) score += countOccurrences(haystack, token);
      return { turn, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.turn.at - a.turn.at);

  if (scored.length) {
    return scored.slice(0, limit).map(({ turn, score }) => ({ ...cloneTurn(turn), score }));
  }
  // Nothing matched: hand back the newest turns with a zero score so the caller
  // always receives usable context instead of an empty array.
  return turns.slice(-limit).reverse().map((turn) => ({ ...cloneTurn(turn), score: 0 }));
};

/**
 * Embed the query plus every turn that has no cached vector. Cached vectors are
 * written back to storage. Throws (caught by the caller) if the provider cannot
 * embed, which triggers the keyword fallback.
 */
const embedForSearch = async (
  turns: StoredTurn[],
  query: string,
  provider: string,
  model: string,
  apiKey: string,
): Promise<number[]> => {
  const ai = provider as AIProvider;

  const queryVectors = await aiService.embeddings(ai, model, apiKey, query);
  const queryVector = Array.isArray(queryVectors) ? queryVectors[0] : undefined;
  if (!queryVector || !queryVector.length) throw new Error('Empty query embedding');

  const pending = turns
    .map((turn, index) => ({ index, text: turn.text, hasEmbedding: Array.isArray(turn.embedding) && turn.embedding.length > 0 }))
    .filter((entry) => !entry.hasEmbedding && entry.text.trim().length > 0);

  let updated = false;
  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH);
    const vectors = await aiService.embeddings(ai, model, apiKey, batch.map((entry) => entry.text));
    if (!Array.isArray(vectors) || vectors.length !== batch.length) {
      throw new Error('Embedding response size mismatch');
    }
    batch.forEach((entry, offset) => {
      const vector = vectors[offset];
      if (Array.isArray(vector) && vector.length) {
        // Round to keep the cached vectors from eating the storage quota.
        turns[entry.index].embedding = vector.map((n) => Number(n.toFixed(5)));
        updated = true;
      }
    });
  }
  if (updated) commit(turns);

  return queryVector;
};

/* ------------------------------------------------------------------ *
 * Prompt formatting helpers
 * ------------------------------------------------------------------ */

/** Short, human relative timestamp, e.g. "2 days ago". */
const relativeTime = (at: number): string => {
  if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0) return '';
  const diff = Date.now() - at;
  if (diff < 45_000) return 'just now';
  const plural = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'} ago`;

  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return plural(minutes, 'minute');
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return plural(hours, 'hour');
  const days = Math.round(diff / 86_400_000);
  if (days < 7) return plural(days, 'day');
  const weeks = Math.round(days / 7);
  if (days < 30) return plural(weeks, 'week');
  const months = Math.round(days / 30);
  if (days < 365) return plural(months, 'month');
  return plural(Math.round(days / 365), 'year');
};

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

export const memoryService = {
  /** Newest last. Returns copies; never throws. */
  load(): BingGoTurn[] {
    try {
      return readAll().map(cloneTurn);
    } catch {
      return [];
    }
  },

  append(turn: Omit<BingGoTurn, 'id' | 'at'> & Partial<Pick<BingGoTurn, 'id' | 'at'>>): BingGoTurn {
    const record: StoredTurn = {
      id: turn.id || createId(),
      role: turn.role,
      text: turn.text,
      at: typeof turn.at === 'number' && Number.isFinite(turn.at) ? turn.at : Date.now(),
    };
    if (turn.images?.length) record.images = [...turn.images];
    if (turn.action) record.action = turn.action;

    try {
      commit([...readAll(), record]);
    } catch {
      // Even if persistence fails, the caller still gets a usable turn object.
      cache = [...(cache ?? []), record];
    }
    return { ...record, ...(record.images ? { images: [...record.images] } : {}) };
  },

  clear(): void {
    cache = null;
    try {
      storage()?.removeItem(MEMORY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },

  /** Most recent N turns, oldest first — cheap context for the prompt. */
  recent(n: number = 10): BingGoTurn[] {
    try {
      const size = Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
      return readAll().slice(-size).map(cloneTurn);
    } catch {
      return [];
    }
  },

  /**
   * Semantic recall. Uses embeddings when a provider/model/key is supplied,
   * otherwise (or on any embeddings failure) a case-insensitive keyword scan.
   * Always resolves — errors are swallowed and degrade to the keyword path.
   */
  async search(query: string, k: number = DEFAULT_K, opts: MemoryOptions = {}): Promise<RecalledTurn[]> {
    try {
      const turns = readAll();
      if (!turns.length) return [];
      const limit = Number.isFinite(k) && k > 0 ? Math.max(1, Math.floor(k)) : DEFAULT_K;
      const trimmed = (query ?? '').trim();
      if (!trimmed) {
        return turns.slice(-limit).reverse().map((turn) => ({ ...cloneTurn(turn), score: 0 }));
      }

      const { provider, model, apiKey } = opts;
      if (provider && model && apiKey) {
        try {
          const queryVector = await embedForSearch(turns, trimmed, provider, model, apiKey);
          return turns
            .map((turn) => ({
              turn,
              score: turn.embedding ? cosineSimilarity(queryVector, turn.embedding) : 0,
            }))
            .sort((a, b) => b.score - a.score || b.turn.at - a.turn.at)
            .slice(0, limit)
            .map(({ turn, score }) => ({ ...cloneTurn(turn), score }));
        } catch {
          // fall through to keyword recall
        }
      }
      return keywordSearch(turns, trimmed, limit);
    } catch {
      return [];
    }
  },

  /**
   * Plain-text transcript for the system prompt, oldest first. Drops whole
   * turns from the OLDEST end until the budget fits; if a single remaining turn
   * is still too long, its tail is kept behind an ellipsis.
   */
  buildContext(turns: BingGoTurn[], maxChars: number = DEFAULT_MAX_CHARS): string {
    try {
      if (!Array.isArray(turns) || !turns.length) return '';
      const budget = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : DEFAULT_MAX_CHARS;

      const lines = turns
        .filter((turn) => turn && typeof turn.text === 'string' && turn.text.trim().length > 0)
        .map((turn) => {
          const who = turn.role === 'assistant' ? 'ASSISTANT' : 'USER';
          const stamp = relativeTime(turn.at);
          const text = turn.text.replace(/\s+/g, ' ').trim();
          return stamp ? `${who} (${stamp}): ${text}` : `${who}: ${text}`;
        });
      if (!lines.length) return '';

      let total = lines.reduce((sum, line) => sum + line.length + 1, 0);
      while (lines.length > 1 && total > budget) {
        total -= lines[0].length + 1;
        lines.shift();
      }

      const joined = lines.join('\n');
      if (joined.length > budget) {
        return `\u2026${joined.slice(joined.length - budget + 1)}`;
      }
      return joined;
    } catch {
      return '';
    }
  },

  /** Turns currently held in memory. */
  count(): number {
    try {
      return readAll().length;
    } catch {
      return 0;
    }
  },
};

export default memoryService;
