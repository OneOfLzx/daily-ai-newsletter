/** Milliseconds in one calendar day (for recency windows, not leap-second precise). */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Max age in ms for “published within the last N local days” style filters.
 * @param {number} days - positive integer
 */
export function articleRecencyMaxAgeMs(days) {
  return days * MS_PER_DAY;
}

/**
 * YYYY-MM-DD in local timezone
 * @param {Date} [d]
 */
export function formatLocalYyyyMmDd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Local calendar YYYY-MM-DD for an ISO 8601 instant (same rules as formatLocalYyyyMmDd).
 * @param {string} iso
 * @returns {string} empty string if not parseable
 */
export function formatLocalYyyyMmDdFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatLocalYyyyMmDd(d);
}
