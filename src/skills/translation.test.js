import { describe, it, expect } from 'bun:test';
import { translate, translateBatch } from './translation.js';

describe('Translation Skill', () => {
  const systemPrompt = 'Translate English to Chinese professionally.';

  describe('translate', () => {
    it('returns empty string for empty input', async () => {
      const result = await translate('');
      expect(result).toBe('');
    });

    it('returns mock translation for known text without openai', async () => {
      const result = await translate('Hello, world!');
      expect(result).toBe('你好，世界！');
    });

    it('uses openai with system + user messages', async () => {
      let params;
      const mockOpenAI = {
        chatCompletion: async p => {
          params = p;
          return { content: '你好，世界！', role: 'assistant', usage: {} };
        }
      };

      const testText = 'Hello, world!';
      const result = await translate(testText, { openai: mockOpenAI, systemPrompt });

      expect(result).toBe('你好，世界！');
      expect(params.messages[0].role).toBe('system');
      expect(params.messages[0].content).toBe(systemPrompt);
      expect(params.messages[1].role).toBe('user');
      expect(params.messages[1].content).toContain(testText);
    });

    it('throws without systemPrompt when openai provided', async () => {
      const mockOpenAI = {
        chatCompletion: async () => ({ content: 'x', role: 'assistant' })
      };
      await expect(translate('Hello', { openai: mockOpenAI })).rejects.toThrow('systemPrompt is required');
    });
  });

  describe('translateBatch', () => {
    it('translates multiple texts with mock fallback', async () => {
      const texts = ['Hello, world!', 'API stands for Application Programming Interface.'];
      const results = await translateBatch(texts);
      expect(results.length).toBe(2);
      expect(results[0]).toBe('你好，世界！');
    });

    it('throws for non-array input', async () => {
      expect(translateBatch('not an array')).rejects.toThrow('translateBatch expects an array of texts');
    });
  });
});
