import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { OpenAIClient } from './openai.js';

// Mock the openai package
const mockCreate = mock();
mock.module('openai', () => ({
  default: mock(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    }
  }))
}));

describe('OpenAIClient', () => {
  let client;
  let mockOpenAI;
  
  const testConfig = {
    api_key: 'test-api-key',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4',
    maxRetries: 3,
    timeout: 60000
  };

  beforeEach(() => {
    mockCreate.mockClear();
    client = new OpenAIClient(testConfig);
    mockOpenAI = client.client;
  });

  describe('constructor', () => {
    it('should create an instance with provided config', () => {
      expect(client).toBeDefined();
      expect(client.config.apiKey).toBe(testConfig.api_key);
      expect(client.config.baseURL).toBe(testConfig.base_url);
      expect(client.config.model).toBe(testConfig.model);
    });

    it('should use default values when not provided', () => {
      const minimalClient = new OpenAIClient({ api_key: 'minimal-key' });
      expect(minimalClient.config.model).toBe('gpt-4');
      expect(minimalClient.config.maxRetries).toBe(3);
      expect(minimalClient.config.timeout).toBe(60000);
    });
  });

  describe('token usage', () => {
    it('should initialize with zero token usage', () => {
      const usage = client.getTokenUsage();
      expect(usage.promptTokens).toBe(0);
      expect(usage.completionTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
    });

    it('should reset token usage', () => {
      client.tokenUsage.promptTokens = 100;
      client.resetTokenUsage();
      const usage = client.getTokenUsage();
      expect(usage.promptTokens).toBe(0);
    });
  });

  describe('chatCompletion', () => {
    it('should make a successful chat completion call', async () => {
      const mockResponse = {
        choices: [{ message: { role: 'assistant', content: 'Test response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        model: 'gpt-4',
        id: 'test-id'
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await client.chatCompletion({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.content).toBe('Test response');
      expect(result.role).toBe('assistant');
      expect(client.getTokenUsage().totalTokens).toBe(30);
    });

    it('should use provided model instead of default', async () => {
      const mockResponse = {
        choices: [{ message: { role: 'assistant', content: 'Response' } }],
        usage: null,
        model: 'gpt-3.5-turbo',
        id: 'test-id'
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      await client.chatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-3.5-turbo'
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-3.5-turbo' })
      );
    });

    it('should invoke token usage listener even when usage is null (TUI refresh)', async () => {
      let calls = 0;
      client.setTokenUsageListener(() => {
        calls += 1;
      });
      const mockResponse = {
        choices: [{ message: { role: 'assistant', content: 'No usage' } }],
        usage: null,
        model: 'gpt-4',
        id: 'id'
      };
      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);
      await client.chatCompletion({ messages: [{ role: 'user', content: 'Hi' }] });
      expect(calls).toBe(1);
      client.setTokenUsageListener(null);
    });
  });

  describe('complete', () => {
    it('should make a simple completion with user prompt', async () => {
      const mockResponse = {
        choices: [{ message: { role: 'assistant', content: 'Simple response' } }],
        usage: null,
        model: 'gpt-4',
        id: 'test-id'
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await client.complete('Hello, world!');

      expect(result).toBe('Simple response');
    });

    it('should include system prompt when provided', async () => {
      const mockResponse = {
        choices: [{ message: { role: 'assistant', content: 'With system' } }],
        usage: null,
        model: 'gpt-4',
        id: 'test-id'
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      await client.complete('Hello', 'You are a helpful assistant');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
          ])
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw non-retryable errors immediately', async () => {
      const nonRetryableError = new Error('Invalid request');
      nonRetryableError.status = 400;
      
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(nonRetryableError);

      await expect(
        client.chatCompletion({ messages: [{ role: 'user', content: 'Hello' }] })
      ).rejects.toThrow('Invalid request');
    });
  });
});
