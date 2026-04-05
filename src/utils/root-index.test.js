import { describe, it, expect } from 'bun:test';
import { rootLandingRedirectHtml } from './root-index.js';

describe('rootLandingRedirectHtml', () => {
  it('points to English edition under public/', () => {
    const html = rootLandingRedirectHtml('2026-04-05');
    expect(html).toContain('./public/2026-04-05/index.en.html');
    expect(html).toContain('http-equiv="refresh"');
  });
});
