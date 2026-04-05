import { describe, it, expect } from 'bun:test';
import { extractProjects } from './index.js';

describe('GitHub Trends Collector', () => {
  describe('extractProjects', () => {
    it('should extract GitHub repository links from HTML', () => {
      const html = `
        <div>
          <a href="https://github.com/owner1/repo1">Repo 1</a>
          <p>Description for repo 1</p>
          <a href="https://github.com/owner2/repo2">Repo 2</a>
          <p>Description for repo 2</p>
        </div>
      `;
      const projects = extractProjects(html);
      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0].name).toBe('owner1/repo1');
      expect(projects[0].link).toBe('https://github.com/owner1/repo1');
    });

    it('should remove duplicate repositories', () => {
      const html = `
        <div>
          <a href="https://github.com/owner1/repo1">Repo 1</a>
          <a href="https://github.com/owner1/repo1">Repo 1 Again</a>
        </div>
      `;
      const projects = extractProjects(html);
      expect(projects).toHaveLength(1);
    });

    it('should return up to 20 projects', () => {
      let html = '<div>';
      for (let i = 0; i < 25; i++) {
        html += `<a href="https://github.com/owner/repo${i}">Repo ${i}</a>`;
      }
      html += '</div>';
      const projects = extractProjects(html);
      expect(projects.length).toBeLessThanOrEqual(20);
    });
  });
});
