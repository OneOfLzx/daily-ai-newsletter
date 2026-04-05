#!/usr/bin/env bun
/**
 * 集成脚本：用本仓库的 summarizeGitHubProject + 真实 GitMCP + 配置里的 LLM，
 * 对指定 GitHub 仓库做摘要。会在终端打印 system prompt、每轮 LLM 请求/响应、最终摘要。
 *
 * 用法（在项目根目录）:
 *   bun run scripts/test-github-repo-mcp-summary.js
 *   bun run scripts/test-github-repo-mcp-summary.js https://github.com/owner/repo
 *
 * 依赖: 根目录 config.yaml 中有效的 llm（且模型需支持 Chat Completions 的 tools）。
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../src/config/index.js';
import { OpenAIClient } from '../src/llm/openai.js';
import { loadSkillSystemPrompts } from '../src/skills/prompts.js';
import { summarizeGitHubProject } from '../src/skills/summarization.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function truncate(str, max) {
  if (str == null) return str;
  const s = String(str);
  return s.length <= max ? s : `${s.slice(0, max)}\n... [truncated, total ${s.length} chars]`;
}

/**
 * @param {import('../src/llm/openai.js').OpenAIClient} client
 */
function wrapLoggingChatCompletion(client) {
  const orig = client.chatCompletion.bind(client);
  let round = 0;
  client.chatCompletion = async params => {
    round += 1;
    console.log(`\n========== LLM 请求 #${round} ==========`);
    const logged = {
      model: params.model,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      optionsKeys: params.options ? Object.keys(params.options) : [],
      messages: (params.messages || []).map(m => {
        const row = { role: m.role };
        if (m.content != null) {
          row.content = truncate(m.content, 4000);
        }
        if (m.tool_calls) {
          row.tool_calls = m.tool_calls;
        }
        if (m.tool_call_id) {
          row.tool_call_id = m.tool_call_id;
        }
        return row;
      })
    };
    if (params.options?.tools) {
      logged.tools_count = params.options.tools.length;
      logged.tool_names_preview = params.options.tools.slice(0, 8).map(t => t.function?.name);
    }
    console.log(JSON.stringify(logged, null, 2));

    const r = await orig(params);

    console.log(`\n========== LLM 响应 #${round} ==========`);
    console.log('finish_reason:', r.finish_reason);
    console.log('content:\n', truncate(r.content || '', 6000) || '(empty)');
    if (r.tool_calls?.length) {
      console.log('tool_calls:', JSON.stringify(r.tool_calls, null, 2));
    }
    return r;
  };
  return client;
}

async function main() {
  const repoUrl = process.argv[2];
  const configPath = path.join(root, 'config.yaml');

  console.log('配置:', configPath);
  const config = loadConfig(configPath);

  const openai = new OpenAIClient(config.llm);
  wrapLoggingChatCompletion(openai);

  const skillPrompts = loadSkillSystemPrompts(config);
  const systemPrompt = skillPrompts.github;

  console.log('\n########## System prompt（github-summarization，前 2500 字）##########');
  console.log(truncate(systemPrompt, 2500));

  const gh = config.processing?.github ?? {};

  const project = {
    link: repoUrl,
    name: 'integration-test'
  };

  console.log('\n########## 输入：仓库 URL（user 里还会带任务说明，见上方 LLM 请求 #1）##########');
  console.log(repoUrl);

  console.log('\n########## 调用 summarizeGitHubProject（GitMCP 会话 + 多轮 tool）##########');

  const summary = await summarizeGitHubProject(project, {
    openai,
    systemPrompt,
    mcpMaxRounds: gh.mcp_max_rounds,
    mcpTimeoutMs: gh.mcp_timeout_ms,
    mcpMaxToolResultChars: gh.mcp_max_tool_result_chars
  });

  console.log('\n########## 最终输出（英文摘要）##########');
  console.log(summary);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
