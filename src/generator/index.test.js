import { describe, it, expect, beforeEach } from 'bun:test';
import HtmlGenerator from './index.js';

describe('HtmlGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new HtmlGenerator();
  });

  it('should create an instance of HtmlGenerator', () => {
    expect(generator).toBeInstanceOf(HtmlGenerator);
  });

  it('should escape HTML characters correctly', () => {
    const input = '<script>alert("XSS")</script>';
    const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
    expect(generator.escapeHtml(input)).toBe(expected);
  });

  it('should render summary as Markdown', () => {
    const item = {
      title: 'Test News Title',
      titleZh: '测试新闻标题',
      link: 'https://example.com/news',
      summary: 'Line with **bold** and [a link](https://docs.example/).',
      summaryZh: '中文**粗体**。'
    };
    const htmlEn = generator.generateNewsItem(item, 'web', 'en');
    expect(htmlEn).toContain('<strong>bold</strong>');
    expect(htmlEn).toContain('href="https://docs.example/"');

    const htmlZh = generator.generateNewsItem(item, 'web', 'zh');
    expect(htmlZh).toContain('<strong>粗体</strong>');
  });

  it('should escape raw HTML tags in summary when rendering Markdown', () => {
    const item = {
      title: 'T',
      link: 'https://example.com',
      summary: '<script>alert(1)</script>',
      summaryZh: ''
    };
    const html = generator.generateNewsItem(item, 'web', 'en');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should generate English HTML for a web news item', () => {
    const item = {
      title: 'Test News Title',
      titleZh: '测试新闻标题',
      link: 'https://example.com/news',
      summary: 'This is a test summary.',
      summaryZh: '这是一个测试摘要。'
    };
    const html = generator.generateNewsItem(item, 'web', 'en');
    expect(html).toContain('Test News Title');
    expect(html).toContain('https://example.com/news');
    expect(html).toContain('<p>This is a test summary.</p>');
    expect(html).not.toContain('测试新闻标题');
    expect(html).not.toContain('这是一个测试摘要。');
  });

  it('should generate Chinese HTML for a web news item', () => {
    const item = {
      title: 'Test News Title',
      titleZh: '测试新闻标题',
      link: 'https://example.com/news',
      summary: 'This is a test summary.',
      summaryZh: '这是一个测试摘要。'
    };
    const html = generator.generateNewsItem(item, 'web', 'zh');
    expect(html).toContain('测试新闻标题');
    expect(html).toContain('https://example.com/news');
    expect(html).toContain('<p>这是一个测试摘要。</p>');
    expect(html).not.toContain('Test News Title');
    expect(html).not.toContain('This is a test summary.');
  });

  it('should generate English HTML for a GitHub project item', () => {
    const item = {
      name: 'test-project',
      link: 'https://github.com/test/test-project',
      description: 'A test project',
      descriptionZh: '一个测试项目',
      summary: 'This is a test summary.',
      summaryZh: '这是一个测试摘要。'
    };
    const html = generator.generateNewsItem(item, 'github', 'en');
    expect(html).toContain('test-project');
    expect(html).toContain('https://github.com/test/test-project');
    expect(html).toContain('This is a test summary.');
    expect(html).not.toContain('一个测试项目');
    expect(html).not.toContain('这是一个测试摘要。');
  });

  it('should generate Chinese HTML for a GitHub project item', () => {
    const item = {
      name: 'test-project',
      link: 'https://github.com/test/test-project',
      description: 'A test project',
      descriptionZh: '一个测试项目',
      summary: 'This is a test summary.',
      summaryZh: '这是一个测试摘要。'
    };
    const html = generator.generateNewsItem(item, 'github', 'zh');
    expect(html).toContain('https://github.com/test/test-project');
    expect(html).toContain('这是一个测试摘要。');
  });

  it('should generate complete bilingual HTML pages from unified data', async () => {
    const unifiedData = {
      timestamp: new Date('2026-04-05T12:00:00Z').toISOString(),
      sources: {
        web: [
          {
            name: 'Test Web Source',
            type: 'web',
            items: [
              {
                title: 'Test Web Article',
                titleZh: '测试网页文章',
                link: 'https://example.com/web',
                summary: 'Web article summary.',
                summaryZh: '网页文章摘要。'
              }
            ]
          }
        ],
        rss: [],
        github: [
          {
            name: 'Test GitHub Source',
            type: 'github',
            items: [
              {
                name: 'test-github-project',
                link: 'https://github.com/test/project',
                description: 'GitHub project description.',
                descriptionZh: 'GitHub项目描述。',
                summary: 'GitHub project summary.',
                summaryZh: 'GitHub项目摘要。'
              }
            ]
          }
        ]
      }
    };

    const result = await generator.generate(unifiedData, {
      ui: { max_visible_items_per_source: 1 },
      site: { github_repo_url: 'https://github.com/test/repo' }
    });
    expect(result.en).toContain('<!DOCTYPE html>');
    expect(result.en).toContain('rel="icon"');
    expect(result.en).toContain('../favicon.svg');
    expect(result.en).toContain('Daily AI Newsletter');
    expect(result.en).toContain('Test Web Source');
    expect(result.en).toContain('Test Web Article');
    expect(result.en).toContain('GitHub - Test GitHub Source');
    expect(result.en).toContain('test-github-project');
    expect(result.en).toContain('class="action-row"');
    expect(result.en).toContain('href="../archive/index.html"');
    expect(result.en).toContain('id="tocToggle"');
    expect(result.en).toContain('data-toc-link="1"');
    expect(result.en).toContain('data-toggle-items="1"');
    expect(result.en).toContain('Show all (1)');
    expect(result.en).toContain('class="btn btn-github"');
    expect(result.en).toContain('切换到中文');
    
    expect(result.zh).toContain('<!DOCTYPE html>');
    expect(result.zh).toContain('每日AI简讯');
    expect(result.zh).toContain('测试网页文章');
    expect(result.zh).toContain('GitHub项目摘要。');
    expect(result.zh).toContain('href="../archive/index.html"');
    expect(result.zh).toContain('展开全部（1）');
    expect(result.zh).toContain('历史归档');
    expect(result.zh).toContain('Switch to English');
  });
});
