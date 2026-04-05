import { describe, it, expect } from 'bun:test';
import { summarizeArticle, summarizeGitHubProject } from './summarization.js';
import { USER_PROMPTS } from './prompts.js';

describe('Summarization Skill', () => {
  const systemPrompt = 'You summarize technical content in English.';

  it('summarizeArticle throws without openai', async () => {
    await expect(summarizeArticle('x', { systemPrompt })).rejects.toThrow('OpenAI client is required');
  });

  it('summarizeArticle throws without systemPrompt', async () => {
    const mockOpenAI = {
      chatCompletion: async () => ({ content: 'ok', role: 'assistant', usage: {} })
    };
    await expect(summarizeArticle('body', { openai: mockOpenAI })).rejects.toThrow('systemPrompt is required');
  });

  it('summarizeArticle calls chatCompletion with system + user', async () => {
    let params;
    const mockOpenAI = {
      chatCompletion: async p => {
        params = p;
        return { content: 'Test summary', role: 'assistant', usage: {} };
      }
    };

    const result = await summarizeArticle('Article body', { openai: mockOpenAI, systemPrompt });
    expect(result).toBe('Test summary');
    expect(params.messages[0].role).toBe('system');
    expect(params.messages[0].content).toBe(systemPrompt);
    expect(params.messages[1].role).toBe('user');
    expect(params.messages[1].content).toContain('Article body');
  });

  it('summarizeGitHubProject without valid GitHub URL uses missing-repo user prompt', async () => {
    let params;
    const mockOpenAI = {
      chatCompletion: async p => {
        params = p;
        return { content: 'No link', finish_reason: 'stop', usage: {} };
      }
    };

    const project = { name: 'p', description: 'd' };
    const result = await summarizeGitHubProject(project, { openai: mockOpenAI, systemPrompt });
    expect(result).toBe('No link');
    expect(params.messages).toHaveLength(2);
    expect(params.messages[1].content).toBe(USER_PROMPTS.summarizeGitHubMissingRepo);
  });

  it('summarizeGitHubProject executes MCP when LLM returns tool_calls', async () => {
    let callN = 0;
    let toolInvoked;
    const mockOpenAI = {
      chatCompletion: async p => {
        if (callN++ === 0) {
          expect(p.options?.tools?.length).toBeGreaterThan(0);
          return {
            content: '',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'fetch_test_documentation', arguments: '{}' }
              }
            ],
            finish_reason: 'tool_calls',
            usage: {}
          };
        }
        expect(p.messages.some(m => m.role === 'tool')).toBe(true);
        return { content: 'Final GH summary', finish_reason: 'stop', usage: {} };
      }
    };

    const runMcpSession = async (_url, _opts, fn) =>
      fn({
        listTools: async () => [
          {
            name: 'fetch_test_documentation',
            description: 'docs',
            inputSchema: { type: 'object', properties: {} }
          }
        ],
        callTool: async (name, args) => {
          toolInvoked = { name, args };
          return 'README from MCP';
        }
      });

    const project = { link: 'https://github.com/o/r' };
    const result = await summarizeGitHubProject(project, {
      openai: mockOpenAI,
      systemPrompt,
      runMcpSession,
      mcpMaxRounds: 5
    });

    expect(result).toBe('Final GH summary');
    expect(toolInvoked).toEqual({ name: 'fetch_test_documentation', args: {} });
  });

  it('summarizeGitHubProject throws when exceeding mcpMaxRounds', async () => {
    const mockOpenAI = {
      chatCompletion: async () => ({
        content: '',
        tool_calls: [
          {
            id: 'call_x',
            type: 'function',
            function: { name: 't', arguments: '{}' }
          }
        ],
        finish_reason: 'tool_calls',
        usage: {}
      })
    };

    const runMcpSession = async (_u, _o, fn) =>
      fn({
        listTools: async () => [{ name: 't', inputSchema: { type: 'object', properties: {} } }],
        callTool: async () => 'more'
      });

    await expect(
      summarizeGitHubProject(
        { link: 'https://github.com/o/r' },
        {
          openai: mockOpenAI,
          systemPrompt,
          runMcpSession,
          mcpMaxRounds: 2
        }
      )
    ).rejects.toThrow('exceeded 2 tool rounds');
  });
});
