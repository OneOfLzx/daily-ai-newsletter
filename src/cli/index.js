#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadConfig } from '../config/index.js';
import NewsPipeline from '../pipeline/index.js';
import { OpenAIClient } from '../llm/openai.js';
import Logger from '../utils/logger.js';

function printHelp() {
  console.log(`
Daily AI Newsletter CLI

Usage:
  daily-ai-newsletter [command] [--debug]

Commands:
  generate   Generate HTML newsletter (default when command omitted)
  help       Show this message

Options:
  --debug    Verbose / debug logging
`);
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      debug: { type: 'boolean', default: false }
    },
    allowPositionals: true,
    strict: false
  });

  const logger = new Logger('cli', values.debug);

  const cmd = positionals[0];
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }

  if (cmd !== undefined && cmd !== 'generate') {
    logger.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(1);
  }

  try {
    logger.info('Starting newsletter generation...');
    const config = loadConfig();
    const openai = new OpenAIClient(config.llm);

    const pipeline = new NewsPipeline(config);
    await pipeline.run(config.sources, { openai });
    const { promptTokens, completionTokens, totalTokens } = openai.getTokenUsage();
    logger.info(
      `Token 用量 — 输入: ${promptTokens}, 输出: ${completionTokens}, 合计: ${totalTokens}`
    );
    logger.info('Done.');
  } catch (err) {
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
