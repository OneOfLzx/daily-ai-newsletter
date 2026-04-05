import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

import Logger from '../utils/logger.js';

const logger = new Logger('gitmcp');

/**
 * @param {string} link
 * @returns {{ owner: string, repo: string } | null}
 */
export function parseGitHubRepoFromLink(link) {
  if (!link || typeof link !== 'string') return null;
  const m = link.trim().match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  const repo = m[2].replace(/\.git$/i, '');
  return { owner: m[1], repo };
}

/**
 * GitMCP server base URL for a repository (see https://gitmcp.io/).
 * @param {string} owner
 * @param {string} repo
 */
export function buildGitMcpServerUrl(owner, repo) {
  return `https://gitmcp.io/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

/**
 * @param {import('@modelcontextprotocol/sdk/types.js').CallToolResult} result
 */
export function extractTextFromCallToolResult(result) {
  if (!result?.content?.length) return '';
  return result.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n\n')
    .trim();
}

/**
 * Map GitMCP `tools/list` entries to OpenAI Chat Completions `tools` format.
 * @param {import('@modelcontextprotocol/sdk/types.js').Tool[]} mcpTools
 * @returns {object[]}
 */
export function mcpToolsToOpenAITools(mcpTools) {
  if (!Array.isArray(mcpTools)) return [];
  return mcpTools.map(t => {
    const params =
      t.inputSchema && typeof t.inputSchema === 'object' && !Array.isArray(t.inputSchema)
        ? t.inputSchema
        : { type: 'object', properties: {} };
    const desc =
      t.description && typeof t.description === 'string'
        ? t.description.slice(0, 8000)
        : `GitMCP tool: ${t.name}`;
    return {
      type: 'function',
      function: {
        name: t.name,
        description: desc,
        parameters: params
      }
    };
  });
}

/**
 * @param {URL} baseUrl
 * @param {import('@modelcontextprotocol/sdk/client/streamableHttp.js').StreamableHTTPClientTransportOptions} [opts]
 */
export async function connectGitMcp(baseUrl, opts = {}) {
  const streamClient = new Client({ name: 'daily-ai-newsletter', version: '1.0.0' });
  try {
    const transport = new StreamableHTTPClientTransport(baseUrl, opts);
    await streamClient.connect(transport);
    return { client: streamClient, transport };
  } catch {
    const sseClient = new Client({ name: 'daily-ai-newsletter', version: '1.0.0' });
    const sseTransport = new SSEClientTransport(baseUrl, opts);
    await sseClient.connect(sseTransport);
    return { client: sseClient, transport: sseTransport };
  }
}

/**
 * One GitMCP session per summarization: list tools and execute tool calls the LLM requests.
 * @param {string} repoHttpsUrl
 * @param {object} [options]
 * @param {number} [options.timeoutMs=120000]
 * @param {number} [options.maxToolResultChars=80000]
 * @param {AbortSignal} [options.signal]
 * @param {(api: { listTools: () => Promise<import('@modelcontextprotocol/sdk/types.js').Tool[]>, callTool: (name: string, args: object) => Promise<string> }) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function runWithGitMcpSession(repoHttpsUrl, options = {}, fn) {
  const parsed = parseGitHubRepoFromLink(repoHttpsUrl);
  if (!parsed) {
    throw new Error('Invalid GitHub repository URL for GitMCP');
  }

  const {
    timeoutMs = 120000,
    maxToolResultChars = 80000,
    signal: userSignal
  } = options;

  const signal = userSignal ?? AbortSignal.timeout(timeoutMs);
  const requestInit = { signal };
  const baseUrl = new URL(buildGitMcpServerUrl(parsed.owner, parsed.repo));

  let transport;
  try {
    const conn = await connectGitMcp(baseUrl, { requestInit });
    const { client, transport: tr } = conn;
    transport = tr;

    const listTools = async () => {
      const r = await client.request({ method: 'tools/list', params: {} }, ListToolsResultSchema);
      return r.tools;
    };

    const callTool = async (name, args) => {
      if (!name || typeof name !== 'string') {
        return '[error: missing tool name]';
      }
      const arguments_ = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
      try {
        const result = await client.request(
          {
            method: 'tools/call',
            params: { name, arguments: arguments_ }
          },
          CallToolResultSchema
        );

        if (result.isError) {
          const errText = extractTextFromCallToolResult(result);
          return errText || '[tool returned isError]';
        }

        let text = extractTextFromCallToolResult(result);
        if (text.length > maxToolResultChars) {
          text = `${text.slice(0, maxToolResultChars)}\n\n[truncated at ${maxToolResultChars} characters]`;
        }
        return text || '(empty tool result)';
      } catch (err) {
        logger.warn(`GitMCP tools/call ${name} failed: ${err.message}`);
        return `[tool error: ${err.message}]`;
      }
    };

    return await fn({ listTools, callTool });
  } catch (err) {
    logger.warn(`GitMCP session failed for ${repoHttpsUrl}: ${err.message}`);
    throw err;
  } finally {
    if (transport) {
      await transport.close().catch(() => {});
    }
  }
}
