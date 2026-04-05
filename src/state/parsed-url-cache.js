import fs from 'fs/promises';
import path from 'path';
import Logger from '../utils/logger.js';
import { formatLocalYyyyMmDdFromIso } from '../utils/date.js';

const logger = new Logger('parsed-url-cache');

/**
 * On disk: `{ [canonicalUrl]: ISO8601 }` — link and last processing time (success or LLM failure).
 * Used for cross-run dedup: already-seen links from prior local days are dropped at fetch/merge time;
 * entries from the current local day are ignored for dedup so you can re-run the same day.
 * @typedef {Record<string, string>} ParsedUrlsMap
 */

/**
 * Canonical URL string for deduplication (lowercase host, no hash, trimmed path slashes).
 * @param {string} url
 */
export function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url.trim());
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    }
    return u.href;
  } catch {
    return url.trim();
  }
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function toParsedAtIso(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if (typeof value.parsedAt === 'string') return value.parsedAt;
    if (typeof value.updatedAt === 'string') return value.updatedAt;
  }
  return null;
}

export function defaultParsedUrlsPath() {
  return path.join(process.cwd(), 'public', 'parsed-urls.json');
}

export class ParsedUrlCache {
  /**
   * @param {string} [filePath]
   */
  constructor(filePath = defaultParsedUrlsPath()) {
    this.filePath = filePath;
    /** @type {Promise<void>} */
    this._writeChain = Promise.resolve();
  }

  async ensureDir() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * @returns {Promise<ParsedUrlsMap>}
   */
  async loadAll() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return {};
      /** @type {ParsedUrlsMap} */
      const out = {};
      for (const [k, v] of Object.entries(data)) {
        const t = toParsedAtIso(v);
        if (t) out[k] = t;
      }
      return out;
    } catch (e) {
      if (e.code === 'ENOENT') {
        return {};
      }
      logger.warn(`Failed to read cache ${this.filePath}: ${e.message}`);
      return {};
    }
  }

  /**
   * @param {string} url
   * @returns {Promise<{ parsedAt: string } | null>}
   */
  async get(url) {
    const key = normalizeUrl(url);
    if (!key) return null;
    const all = await this.loadAll();
    if (all[key]) return { parsedAt: all[key] };
    for (const [k, t] of Object.entries(all)) {
      if (normalizeUrl(k) === key) return { parsedAt: t };
    }
    return null;
  }

  /**
   * All normalized URLs recorded on disk (keys may be legacy non-canonical).
   * @param {{ skipEntriesOnLocalDate?: string }} [options] - If set (YYYY-MM-DD local), rows whose
   *   parsedAt falls on that local calendar day are omitted (same-day re-runs keep those links).
   * @returns {Promise<Set<string>>}
   */
  async loadSeenUrlSet(options = {}) {
    const { skipEntriesOnLocalDate } = options;
    const all = await this.loadAll();
    const set = new Set();
    for (const [k, t] of Object.entries(all)) {
      if (skipEntriesOnLocalDate) {
        const day = formatLocalYyyyMmDdFromIso(t);
        if (day && day === skipEntriesOnLocalDate) continue;
      }
      const nk = normalizeUrl(k);
      if (nk) set.add(nk);
    }
    return set;
  }

  /**
   * Record that this URL was processed (LLM success or failure); dedup applies from the next local day onward.
   * @param {string} url
   */
  async set(url) {
    const key = normalizeUrl(url);
    if (!key) return;

    const run = async () => {
      await this.ensureDir();
      const all = await this.loadAll();
      all[key] = new Date().toISOString();
      await fs.writeFile(this.filePath, JSON.stringify(all, null, 2), 'utf8');
    };

    this._writeChain = this._writeChain.then(run).catch(err => {
      logger.error(`parsed-urls write failed: ${err.message}`);
    });
    await this._writeChain;
  }
}

export default ParsedUrlCache;
