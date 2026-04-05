import { mcpToolsToOpenAITools, parseGitHubRepoFromLink, runWithGitMcpSession } from '../mcp/gitmcp.js';
import { USER_PROMPTS } from './prompts.js';

/**
 * @param {string} content
 * @param {object} options
 * @param {import('../llm/openai.js').OpenAIClient} options.openai
 * @param {string} options.systemPrompt
 */
export async function summarizeArticle(content, options = {}) {
  const { openai, systemPrompt } = options;

  if (!openai) {
    throw new Error('OpenAI client is required');
  }
  if (!systemPrompt || typeof systemPrompt !== 'string') {
    throw new Error('systemPrompt is required');
  }

  const userContent = `${USER_PROMPTS.summarizeArticle}${content}`;

  const response = await openai.chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    temperature: 0.3
  });

  return response.content.trim();
}

/**
 * @typedef {(repoUrl: string, options: object, fn: (api: { listTools: () => Promise<unknown[]>, callTool: (name: string, args: object) => Promise<string> }) => Promise<string>) => Promise<string>} RunMcpSessionFn
 */

/**
 * GitHub: LLM requests tools; program runs GitMCP tools/call. No pre-filled project metadata.
 *
 * @param {object} project
 * @param {object} options
 * @param {import('../llm/openai.js').OpenAIClient} options.openai
 * @param {string} options.systemPrompt
 * @param {number} [options.mcpMaxRounds=20]
 * @param {number} [options.mcpTimeoutMs]
 * @param {number} [options.mcpMaxToolResultChars]
 * @param {RunMcpSessionFn} [options.runMcpSession] - tests only; default runWithGitMcpSession
 */
export async function summarizeGitHubProject(project, options = {}) {
  const {
    openai,
    systemPrompt,
    mcpMaxRounds = 20,
    mcpTimeoutMs,
    mcpMaxToolResultChars,
    runMcpSession
  } = options;

  if (!openai) {
    throw new Error('OpenAI client is required');
  }
  if (!systemPrompt || typeof systemPrompt !== 'string') {
    throw new Error('systemPrompt is required');
  }

  const repoUrl = typeof project.link === 'string' ? project.link.trim() : '';

  if (!parseGitHubRepoFromLink(repoUrl)) {
    const response = await openai.chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: USER_PROMPTS.summarizeGitHubMissingRepo }
      ],
      temperature: 0.3,
      maxTokens: 500
    });
    return response.content.trim();
  }

  const sessionImpl = runMcpSession || runWithGitMcpSession;
  const mcpOpts = {
    ...(mcpTimeoutMs !== undefined ? { timeoutMs: mcpTimeoutMs } : {}),
    ...(mcpMaxToolResultChars !== undefined ? { maxToolResultChars: mcpMaxToolResultChars } : {})
  };

  return await sessionImpl(repoUrl, mcpOpts, async ({ listTools, callTool }) => {
    const toolsRaw = await listTools();
    const openaiTools = mcpToolsToOpenAITools(toolsRaw);
    if (!openaiTools.length) {
      throw new Error('GitMCP returned no tools for this repository');
    }

    const userTask = `${USER_PROMPTS.summarizeGitHubProject}${repoUrl}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userTask }
    ];

    for (let round = 0; round < mcpMaxRounds; round++) {
      const resp = await openai.chatCompletion({
        messages,
        temperature: 0.3,
        maxTokens: 4096,
        options: {
          tools: openaiTools,
          tool_choice: 'auto'
        }
      });

      const toolCalls = resp.tool_calls;
      if (!toolCalls?.length) {
        return (resp.content || '').trim();
      }

      messages.push({
        role: 'assistant',
        content: resp.content || null,
        tool_calls: toolCalls
      });

      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          args = {};
        }
        const text = await callTool(name, args);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: text
        });
      }
    }

    throw new Error(`GitHub MCP agent exceeded ${mcpMaxRounds} tool rounds`);
  });
}
