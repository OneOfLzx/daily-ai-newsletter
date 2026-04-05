import { describe, it, expect } from 'bun:test';
import {
  parseGitHubRepoFromLink,
  buildGitMcpServerUrl,
  mcpToolsToOpenAITools,
  extractTextFromCallToolResult
} from './gitmcp.js';

describe('gitmcp helpers', () => {
  it('parseGitHubRepoFromLink extracts owner/repo', () => {
    expect(parseGitHubRepoFromLink('https://github.com/foo/bar')).toEqual({ owner: 'foo', repo: 'bar' });
    expect(parseGitHubRepoFromLink('https://www.github.com/foo/bar?x=1')).toEqual({ owner: 'foo', repo: 'bar' });
    expect(parseGitHubRepoFromLink('https://github.com/a/b.git')).toEqual({ owner: 'a', repo: 'b' });
  });

  it('parseGitHubRepoFromLink returns null for non-GitHub', () => {
    expect(parseGitHubRepoFromLink('')).toBeNull();
    expect(parseGitHubRepoFromLink('https://gitlab.com/a/b')).toBeNull();
  });

  it('buildGitMcpServerUrl encodes path segments', () => {
    expect(buildGitMcpServerUrl('vercel', 'next.js')).toBe('https://gitmcp.io/vercel/next.js');
  });

  it('mcpToolsToOpenAITools maps MCP tools to OpenAI function tools', () => {
    const out = mcpToolsToOpenAITools([
      {
        name: 'fetch_x_documentation',
        description: 'Read docs',
        inputSchema: { type: 'object', properties: { q: { type: 'string' } } }
      }
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('function');
    expect(out[0].function.name).toBe('fetch_x_documentation');
    expect(out[0].function.parameters.type).toBe('object');
  });

  it('mcpToolsToOpenAITools uses empty object schema when inputSchema missing', () => {
    const out = mcpToolsToOpenAITools([{ name: 't' }]);
    expect(out[0].function.parameters).toEqual({ type: 'object', properties: {} });
  });

  it('extractTextFromCallToolResult joins text blocks', () => {
    expect(
      extractTextFromCallToolResult({
        content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }],
        isError: false
      })
    ).toBe('a\n\nb');
  });
});
