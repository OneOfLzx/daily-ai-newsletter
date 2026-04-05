import { describe, it, expect, spyOn, beforeEach, afterAll } from 'bun:test';
import deploy from './index.js';
import ghpages from 'gh-pages';

// Mock gh-pages
spyOn(ghpages, 'publish').mockImplementation((dir, opts, callback) => {
  callback(null);
});

describe('deploy script', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    ghpages.publish.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should not throw if GITHUB_PAGES_REPO is not set', async () => {
    let threw = false;
    try {
      await deploy();
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(ghpages.publish).not.toHaveBeenCalled();
  });

  it('should use default config and call gh-pages publish when repo is set', async () => {
    process.env.GITHUB_PAGES_REPO = 'https://github.com/test/test-repo.git';
    
    let threw = false;
    try {
      await deploy();
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(ghpages.publish).toHaveBeenCalled();
    const publishRoot = ghpages.publish.mock.calls[0][0];
    expect(String(publishRoot)).toContain('.ghpages-build');
  });

  it('should allow custom config overrides', async () => {
    process.env.GITHUB_PAGES_REPO = 'https://github.com/test/test-repo.git';
    const customRepo = 'https://github.com/custom/custom-repo.git';
    const customBranch = 'custom-branch';
    
    await deploy({ repo: customRepo, branch: customBranch });
    const publishCall = ghpages.publish.mock.calls[0];
    expect(publishCall[1].repo).toBe(customRepo);
    expect(publishCall[1].branch).toBe(customBranch);
  });
});