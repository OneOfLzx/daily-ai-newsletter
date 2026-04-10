export const SOURCE_CHANNELS = ['web', 'rss', 'github'];

/**
 * Top-level key order under `sources:` in config (YAML preserves mapping key order).
 * @param {Record<string, unknown>} sources
 * @returns {string[]}
 */
export function sourceChannelOrderFromConfig(sources = {}) {
  const allowed = new Set(SOURCE_CHANNELS);
  return Object.keys(sources).filter(k => allowed.has(k) && Array.isArray(sources[k]));
}

/**
 * Dedupe channel keys and append any missing `web` / `rss` / `github`.
 * @param {string[]} [sourceChannelOrder]
 * @returns {string[]}
 */
export function normalizeSourceChannelOrder(sourceChannelOrder = SOURCE_CHANNELS) {
  const seen = new Set();
  const order = [];
  for (const k of sourceChannelOrder || []) {
    if (SOURCE_CHANNELS.includes(k) && !seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
  }
  for (const k of SOURCE_CHANNELS) {
    if (!seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
  }
  return order;
}
