import { describe, it, expect } from 'bun:test';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ParsedUrlCache, normalizeUrl } from './parsed-url-cache.js';
import { formatLocalYyyyMmDd } from '../utils/date.js';

describe('ParsedUrlCache', () => {
  it('normalizeUrl lowercases host and strips hash', () => {
    expect(normalizeUrl('HTTPS://Example.COM/path#frag')).toBe('https://example.com/path');
  });

  it('normalizeUrl trims trailing slash on path', () => {
    expect(normalizeUrl('https://x.test/a/b/')).toBe('https://x.test/a/b');
  });

  it('loads legacy entry objects using updatedAt as parsedAt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'parsed-url-test-'));
    const fp = join(dir, 'parsed-urls.json');
    await writeFile(
      fp,
      JSON.stringify({
        'https://a.test/article': {
          summary: 'old',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      })
    );
    const c = new ParsedUrlCache(fp);
    expect(await c.get('https://a.test/article')).toEqual({ parsedAt: '2026-01-01T00:00:00.000Z' });
    await rm(dir, { recursive: true });
  });

  it('loadSeenUrlSet omits entries from skipEntriesOnLocalDate (same-day re-run)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'parsed-url-test-'));
    const fp = join(dir, 'parsed-urls.json');
    const todayKey = formatLocalYyyyMmDd();
    await writeFile(
      fp,
      JSON.stringify({
        'https://today.test/a': new Date().toISOString(),
        'https://old.test/b': '2000-01-01T00:00:00.000Z'
      })
    );
    const c = new ParsedUrlCache(fp);
    const set = await c.loadSeenUrlSet({ skipEntriesOnLocalDate: todayKey });
    expect(set.has('https://today.test/a')).toBe(false);
    expect(set.has('https://old.test/b')).toBe(true);
    await rm(dir, { recursive: true });
  });

  it('loadSeenUrlSet includes normalized keys from legacy storage keys', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'parsed-url-test-'));
    const fp = join(dir, 'parsed-urls.json');
    await writeFile(
      fp,
      JSON.stringify({
        'HTTPS://LEGACY.TEST/path/': '2026-01-01T00:00:00.000Z'
      })
    );
    const c = new ParsedUrlCache(fp);
    const set = await c.loadSeenUrlSet();
    expect(set.has('https://legacy.test/path')).toBe(true);
    await rm(dir, { recursive: true });
  });

  it('get resolves legacy row key via normalizeUrl', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'parsed-url-test-'));
    const fp = join(dir, 'parsed-urls.json');
    await writeFile(
      fp,
      JSON.stringify({
        'HTTPS://LEGACY.TEST/x': '2026-02-02T00:00:00.000Z'
      })
    );
    const c = new ParsedUrlCache(fp);
    expect(await c.get('https://legacy.test/x')).toEqual({ parsedAt: '2026-02-02T00:00:00.000Z' });
    await rm(dir, { recursive: true });
  });

  it('set persists canonical url to ISO timestamp string', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'parsed-url-test-'));
    const fp = join(dir, 'parsed-urls.json');
    const c = new ParsedUrlCache(fp);
    await c.set('HTTPS://B.TEST/x#frag');
    const raw = JSON.parse(await readFile(fp, 'utf8'));
    expect(Object.keys(raw)).toEqual(['https://b.test/x']);
    expect(raw['https://b.test/x']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await rm(dir, { recursive: true });
  });
});
