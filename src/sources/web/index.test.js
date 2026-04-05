import { describe, it, expect } from 'bun:test';
import {
  extractArticleLinks,
  extractArticleContent,
  sleep,
  getRandomUserAgent,
  isValidTldrEditionPage,
  extractTldrArticleLinks,
  buildTldrDatedListingUrl,
  formatLocalYyyyMmDd,
  countTldrExternalArticleLinks
} from './index.js';

describe('Web Scraper', () => {
  describe('getRandomUserAgent', () => {
    it('should return a non-empty string', () => {
      const ua = getRandomUserAgent();
      expect(typeof ua).toBe('string');
      expect(ua.length).toBeGreaterThan(0);
    });
  });

  describe('extractArticleLinks', () => {
    it('should extract links from simple HTML', () => {
      const html = `
        <div>
          <a href="https://example.com/article1">Article 1</a>
          <a href="https://example.com/article2">Article 2</a>
        </div>
      `;
      const links = extractArticleLinks(html);
      expect(links).toHaveLength(2);
      expect(links[0].title).toBe('Article 1');
      expect(links[0].link).toBe('https://example.com/article1');
    });

    it('should remove duplicate links', () => {
      const html = `
        <div>
          <a href="https://example.com/article1">Article 1</a>
          <a href="https://example.com/article1">Article 1 Duplicate</a>
        </div>
      `;
      const links = extractArticleLinks(html);
      expect(links).toHaveLength(1);
    });
  });

  describe('TLDR helpers', () => {
    it('buildTldrDatedListingUrl joins base and date', () => {
      expect(buildTldrDatedListingUrl('https://tldr.tech/ai/', '2026-04-03')).toBe(
        'https://tldr.tech/ai/2026-04-03'
      );
      expect(buildTldrDatedListingUrl('https://tldr.tech/ai', '2026-04-03')).toBe(
        'https://tldr.tech/ai/2026-04-03'
      );
    });

    it('formatLocalYyyyMmDd uses local calendar date', () => {
      const s = formatLocalYyyyMmDd(new Date(2026, 3, 5));
      expect(s).toBe('2026-04-05');
    });

    it('isValidTldrEditionPage accepts rich external-link pages', () => {
      const links = Array.from({ length: 10 }, (_, i) => ({
        href: `https://news.example.com/a${i}`,
        text: `Some article title number ${i} with enough chars`
      }));
      const html = `<html><body>${links
        .map(l => `<p><a href="${l.href}">${l.text}</a></p>`)
        .join('')}</body></html>`;
      expect(countTldrExternalArticleLinks(html)).toBeGreaterThanOrEqual(8);
      expect(isValidTldrEditionPage(html)).toBe(true);
    });

    it('isValidTldrEditionPage rejects signup-style landing', () => {
      const html = `
        <html><body>
          <h1>Keep up with AI</h1>
          <a href="https://tldr.tech/ai">TLDR</a>
          <a href="https://other.example.com/one">One</a>
        </body></html>`;
      expect(isValidTldrEditionPage(html)).toBe(false);
    });

    it('extractTldrArticleLinks skips short or junk anchors', () => {
      const html = `
        <body>
          <a href="https://deepmind.google/gemma/">Gemma 4 Open Models (5 minute read)</a>
          <a href="https://cursor.com/blog">Cursor 3 (5 minute read)</a>
          <a href="https://tldr.tech/ad">Advertise</a>
          <a href="mailto:x@y.com">Email</a>
          <a href="https://evil.com/x">Hi</a>
        </body>`;
      const got = extractTldrArticleLinks(html);
      expect(got.length).toBe(2);
      expect(got.map(g => g.link)).toContain('https://deepmind.google/gemma/');
    });
  });

  describe('extractArticleContent', () => {
    it('should extract text content and remove scripts', () => {
      const html = `
        <html>
          <body>
            <script>console.log('test')</script>
            <style>body { color: red; }</style>
            <div>This is the article content.</div>
          </body>
        </html>
      `;
      const content = extractArticleContent(html);
      expect(content).toContain('This is the article content.');
      expect(content).not.toContain('console.log');
      expect(content).not.toContain('color: red');
    });
  });
});
