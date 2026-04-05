import { describe, it, expect } from 'bun:test';
import { MS_PER_DAY } from '../../utils/date.js';
import { filterRssItemsByRecency, RSS_DEFAULT_MAX_AGE_MS } from './index.js';

describe('RSS Parser', () => {
  it('filterRssItemsByRecency keeps recent and drops stale or undated (7-day window)', () => {
    const now = new Date('2026-04-05T12:00:00Z');
    const items = [
      { title: 'old', link: 'https://a.test/1', pubDate: '2026-03-20T00:00:00Z' },
      { title: 'fresh', link: 'https://a.test/2', pubDate: '2026-04-04T00:00:00Z' },
      { title: 'nodate', link: 'https://a.test/3' },
      { title: 'iso', link: 'https://a.test/4', isoDate: '2026-04-03T00:00:00Z' }
    ];
    const got = filterRssItemsByRecency(items, now, 7 * MS_PER_DAY);
    expect(got.map(i => i.title).sort()).toEqual(['fresh', 'iso'].sort());
  });

  it('filterRssItemsByRecency default window is 2 days', () => {
    const now = new Date('2026-04-05T12:00:00Z');
    const items = [
      { title: 'edge', link: 'https://a.test/1', pubDate: '2026-04-03T00:00:00Z' },
      { title: 'fresh', link: 'https://a.test/2', pubDate: '2026-04-04T00:00:00Z' }
    ];
    const got = filterRssItemsByRecency(items, now);
    expect(got.map(i => i.title)).toEqual(['fresh']);
    expect(RSS_DEFAULT_MAX_AGE_MS).toBe(2 * MS_PER_DAY);
  });

  // Network RSS tests removed — they rate-limit in CI; filterRssItemsByRecency covers core policy.
});
