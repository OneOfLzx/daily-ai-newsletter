// Tests for NewsPipeline
import { describe, it, expect, beforeEach } from 'bun:test';
import { NewsPipeline, filterRawDataBySeenUrls } from './index.js';

describe('NewsPipeline', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new NewsPipeline({
      skills: {
        web: 'summarization',
        rss: 'summarization',
        github: 'summarization',
        translation: 'translation'
      },
      processing: { concurrency: 2 }
    });
  });

  it('should be instantiable', () => {
    expect(pipeline).toBeDefined();
    expect(pipeline instanceof NewsPipeline).toBe(true);
  });

  it('should format data into unified structure', () => {
    const processedData = {
      web: [
        {
          source: 'Test Web Source',
          articles: [
            {
              title: 'Test Article',
              titleZh: '[翻译] Test Article',
              link: 'https://example.com',
              summary: 'Test summary',
              summaryZh: '[翻译] Test summary',
              content: 'Test content',
              _llmDone: true
            }
          ],
          error: null
        }
      ],
      rss: [],
      github: []
    };

    const unifiedData = pipeline.formatUnifiedData(processedData, new Date().toISOString());

    expect(unifiedData).toBeDefined();
    expect(unifiedData.timestamp).toBeDefined();
    expect(unifiedData.sources).toBeDefined();
    expect(unifiedData.sources.web).toBeArray();
    expect(unifiedData.sources.web[0].name).toBe('Test Web Source');
    expect(unifiedData.sources.web[0].items).toBeArray();
    expect(unifiedData.sources.web[0].items[0]._llmDone).toBeUndefined();
  });

  it('should have required methods', () => {
    expect(typeof pipeline.fetchAllSources).toBe('function');
    expect(typeof pipeline.formatUnifiedData).toBe('function');
    expect(typeof pipeline.run).toBe('function');
  });

  it('should handle empty sources in fetchAllSources', async () => {
    const result = await pipeline.fetchAllSources({});
    expect(result).toBeDefined();
    expect(result.web).toBeArray();
    expect(result.rss).toBeArray();
    expect(result.github).toBeArray();
  });

  it('filterRawDataBySeenUrls drops web/rss articles with seen links; leaves github unchanged', () => {
    const seen = new Set(['https://seen.example/a']);
    const raw = {
      web: [
        {
          source: 'w',
          articles: [
            { title: 'keep', link: 'https://new.example/x' },
            { title: 'drop', link: 'https://seen.example/a' }
          ]
        }
      ],
      rss: [],
      github: [
        {
          source: 'g',
          projects: [
            { name: 'p1', link: 'https://seen.example/a' },
            { name: 'p2', link: 'https://other.example/repo' }
          ]
        }
      ]
    };
    const out = filterRawDataBySeenUrls(raw, seen);
    expect(out.web[0].articles).toHaveLength(1);
    expect(out.web[0].articles[0].link).toBe('https://new.example/x');
    expect(out.github[0].projects).toHaveLength(2);
    expect(out.github).toBe(raw.github);
  });
});
