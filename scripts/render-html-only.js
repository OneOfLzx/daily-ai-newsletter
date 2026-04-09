#!/usr/bin/env node
/**
 * Re-render HTML from an existing edition's raw-data.json (no LLM / fetch).
 * Uses the same helpers and HtmlGenerator options as NewsPipeline so project
 * changes stay in one place (see src/pipeline/index.js).
 *
 * Usage:
 *   node scripts/render-html-only.js --date 2026-04-07
 *   node scripts/render-html-only.js --date 2026-04-07 --config ./config.yaml
 *   node scripts/render-html-only.js --date 2026-04-07 --publicDir ./public
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import HtmlGenerator from '../src/generator/index.js';
import { loadConfig } from '../src/config/index.js';
import {
  prepareUnifiedDataForHtml,
  htmlGenerateOptionsFromConfig,
} from '../src/pipeline/index.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const v = argv[i + 1];
    if (v && !v.startsWith('--')) {
      out[key] = v;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function usageAndExit(code, msg) {
  if (msg) console.error(msg);
  console.error(
    [
      'Usage:',
      '  node scripts/render-html-only.js --date YYYY-MM-DD [--config ./config.yaml] [--publicDir ./public]',
      '',
      'Loads config like the main CLI (default: ./config.yaml) for site, ui, and source order fallbacks.',
      '',
      'Reads:',
      '  <publicDir>/YYYY-MM-DD/raw-data.json',
      '',
      'Writes:',
      '  <publicDir>/YYYY-MM-DD/index.en.html',
      '  <publicDir>/YYYY-MM-DD/index.zh.html',
      '  <publicDir>/archive/index.html',
      '  ./index.html (root redirect)',
    ].join('\n')
  );
  process.exit(code);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dateKey = typeof args.date === 'string' ? args.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    usageAndExit(2, 'Missing or invalid --date (expected YYYY-MM-DD).');
  }

  const publicDir =
    typeof args.publicDir === 'string'
      ? path.resolve(process.cwd(), args.publicDir)
      : path.resolve(process.cwd(), 'public');

  const dateDir = path.join(publicDir, dateKey);
  const rawDataPath = path.join(dateDir, 'raw-data.json');

  const config =
    typeof args.config === 'string'
      ? loadConfig(path.resolve(process.cwd(), args.config))
      : loadConfig();

  let unifiedData = await readJson(rawDataPath);
  unifiedData = prepareUnifiedDataForHtml(unifiedData, config);

  const generator = new HtmlGenerator();
  await generator.generate(
    unifiedData,
    htmlGenerateOptionsFromConfig(config, { dateDir, dateKey }, { incremental: true })
  );

  console.log(`Re-rendered HTML for ${dateKey} from ${rawDataPath}`);
}

main().catch(err => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
