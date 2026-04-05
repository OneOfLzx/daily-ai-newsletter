// News Data Aggregation Pipeline
import path from 'node:path';
import fs from 'node:fs/promises';

import { WebScraper } from '../sources/web/index.js';
import { collectRssArticles } from '../sources/rss/index.js';
import { GitHubTrendsCollector } from '../sources/github/index.js';
import { summarizeArticle, summarizeGitHubProject } from '../skills/summarization.js';
import { translate } from '../skills/translation.js';
import { loadSkillSystemPrompts } from '../skills/prompts.js';
import { ParsedUrlCache, normalizeUrl } from '../state/parsed-url-cache.js';
import { LiveTty } from '../utils/live-tty.js';
import { ensureDir } from '../utils/path.js';
import { formatLocalYyyyMmDd } from '../utils/date.js';
import Logger from '../utils/logger.js';
import HtmlGenerator from '../generator/index.js';

const logger = new Logger('pipeline');

const RUN_META = 'run-meta.json';
const PARTIAL = 'partial.json';
const RAW_DATA = 'raw-data.json';

async function rmrf(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * @param {object} rawData
 * @returns {object} processedData skeleton
 */
function buildProcessedSkeleton(rawData) {
  const processedData = { web: [], rss: [], github: [] };

  for (const sd of rawData.web || []) {
    processedData.web.push({
      source: sd.source,
      articles: (sd.articles || []).map(a => ({
        ...a,
        _llmDone: false,
        summary: '',
        summaryZh: '',
        titleZh: '',
        error: undefined
      })),
      error: sd.error
    });
  }

  for (const sd of rawData.rss || []) {
    processedData.rss.push({
      source: sd.source,
      articles: (sd.articles || []).map(a => ({
        ...a,
        _llmDone: false,
        summary: '',
        summaryZh: '',
        titleZh: '',
        error: undefined
      })),
      error: sd.error
    });
  }

  for (const sd of rawData.github || []) {
    processedData.github.push({
      source: sd.source,
      projects: (sd.projects || []).map(p => ({
        ...p,
        _llmDone: false,
        summary: '',
        summaryZh: '',
        error: undefined
      })),
      error: sd.error
    });
  }

  return processedData;
}

/**
 * Drop web/rss articles listed in parsed-urls from earlier local days.
 * GitHub trending items are not deduped here (not written to parsed-urls either).
 * Items without a normalizable link are kept.
 * @param {{ web?: unknown[], rss?: unknown[], github?: unknown[] }} rawData
 * @param {Set<string>} seenNormalizedUrls
 */
export function filterRawDataBySeenUrls(rawData, seenNormalizedUrls) {
  const keepLink = link => {
    const u = normalizeUrl(link || '');
    if (!u) return true;
    return !seenNormalizedUrls.has(u);
  };
  const filterArticles = articles => (articles || []).filter(a => keepLink(a.link));

  return {
    web: (rawData.web || []).map(block => ({
      ...block,
      articles: filterArticles(block.articles)
    })),
    rss: (rawData.rss || []).map(block => ({
      ...block,
      articles: filterArticles(block.articles)
    })),
    github: rawData.github || []
  };
}

function countRawItems(rawData) {
  let n = 0;
  for (const b of rawData.web || []) n += (b.articles || []).length;
  for (const b of rawData.rss || []) n += (b.articles || []).length;
  for (const b of rawData.github || []) n += (b.projects || []).length;
  return n;
}

export class NewsPipeline {
  constructor(config = {}) {
    this.config = config;
    this.webScraper = new WebScraper();
    this.githubCollector = new GitHubTrendsCollector();
  }

  async fetchAllSources(sources = {}) {
    logger.info('Fetching data from all sources');
    const rawData = {
      web: [],
      rss: [],
      github: []
    };

    if (sources.web && Array.isArray(sources.web)) {
      for (const source of sources.web) {
        try {
          const articles = await this.webScraper.scrapeSource(source);
          rawData.web.push({
            source: source.name,
            articles: articles.map(article => ({ ...article, type: 'web' }))
          });
        } catch (err) {
          logger.error(`Failed to fetch web source ${source.name}: ${err.message}`);
          rawData.web.push({ source: source.name, articles: [], error: err.message });
        }
      }
    }

    if (sources.rss && Array.isArray(sources.rss)) {
      for (const source of sources.rss) {
        try {
          const articles = await collectRssArticles(source, {
            maxRecencyDays: this.config.processing?.max_article_recency_days ?? 2
          });
          rawData.rss.push({
            source: source.name,
            articles: articles.map(article => ({ ...article, type: 'rss' }))
          });
        } catch (err) {
          logger.error(`Failed to fetch RSS source ${source.name}: ${err.message}`);
          rawData.rss.push({ source: source.name, articles: [], error: err.message });
        }
      }
    }

    if (sources.github && Array.isArray(sources.github)) {
      for (const source of sources.github) {
        try {
          const projects = await this.githubCollector.scrapeSource(source);
          rawData.github.push({
            source: source.name,
            projects: projects.map(project => ({ ...project, type: 'github' }))
          });
        } catch (err) {
          logger.error(`Failed to fetch GitHub source ${source.name}: ${err.message}`);
          rawData.github.push({ source: source.name, projects: [], error: err.message });
        }
      }
    }

    return rawData;
  }

  formatUnifiedData(processedData, dateIso) {
    const unifiedData = {
      timestamp: dateIso,
      sources: { web: [], rss: [], github: [] }
    };

    for (const source of processedData.web || []) {
      unifiedData.sources.web.push({
        name: source.source,
        type: 'web',
        items: (source.articles || []).map(article => ({
          title: article.title,
          titleZh: article.titleZh || '',
          link: article.link,
          summary: article.summary || '',
          summaryZh: article.summaryZh || '',
          content: article.content || '',
          error: article.error
        })),
        error: source.error
      });
    }

    for (const source of processedData.rss || []) {
      unifiedData.sources.rss.push({
        name: source.source,
        type: 'rss',
        items: (source.articles || []).map(article => ({
          title: article.title,
          titleZh: article.titleZh || '',
          link: article.link,
          pubDate: article.pubDate,
          summary: article.summary || '',
          summaryZh: article.summaryZh || '',
          content: article.content || '',
          error: article.error
        })),
        error: source.error
      });
    }

    for (const source of processedData.github || []) {
      unifiedData.sources.github.push({
        name: source.source,
        type: 'github',
        items: (source.projects || []).map(project => ({
          name: project.name,
          link: project.link,
          description: project.description || '',
          summary: project.summary || '',
          summaryZh: project.summaryZh || '',
          error: project.error
        })),
        error: source.error
      });
    }

    return unifiedData;
  }

  /**
   * @param {object} sources
   * @param {object} options
   * @param {import('../llm/openai.js').OpenAIClient} options.openai
   * @param {string} [options.publicDir]
   */
  async run(sources = {}, options = {}) {
    const { openai, publicDir = path.join(process.cwd(), 'public') } = options;
    if (!openai) {
      throw new Error('openai client is required');
    }

    const skillPrompts = loadSkillSystemPrompts(this.config);
    const cache = new ParsedUrlCache();
    const concurrency = this.config.processing?.concurrency ?? 6;
    const dateKey = formatLocalYyyyMmDd();
    const dateIso = new Date(
      `${dateKey}T12:00:00`
    ).toISOString();
    const dateDir = path.join(publicDir, dateKey);

    let resume = false;
    let wipedCompleted = false;

    try {
      const metaPath = path.join(dateDir, RUN_META);
      const metaRaw = await fs.readFile(metaPath, 'utf8');
      const meta = JSON.parse(metaRaw);
      if (meta.completed === true) {
        await rmrf(dateDir);
        wipedCompleted = true;
        resume = false;
      } else {
        resume = true;
      }
    } catch {
      resume = false;
    }

    await ensureDir(dateDir);

    if (wipedCompleted || !resume) {
      await fs.writeFile(
        path.join(dateDir, RUN_META),
        JSON.stringify({ completed: false, date: dateKey }, null, 2),
        'utf8'
      );
    }

    let processedData;

    if (resume && !wipedCompleted) {
      try {
        const partialRaw = await fs.readFile(path.join(dateDir, PARTIAL), 'utf8');
        const partial = JSON.parse(partialRaw);
        if (partial.processedData) {
          processedData = partial.processedData;
          logger.info('Resuming from partial.json (skip completed LLM steps)');
        }
      } catch {
        /* fall through to fresh fetch */
      }
    }

    if (!processedData) {
      const seenSet = await cache.loadSeenUrlSet({
        skipEntriesOnLocalDate: dateKey
      });
      const rawData = await this.fetchAllSources(sources);
      const beforeN = countRawItems(rawData);
      const filteredRaw = filterRawDataBySeenUrls(rawData, seenSet);
      const afterN = countRawItems(filteredRaw);
      if (beforeN > afterN) {
        logger.info(
          `parsed-urls dedup: dropped ${beforeN - afterN} item(s) with previously seen link(s)`
        );
      }
      processedData = buildProcessedSkeleton(filteredRaw);
      await fs.writeFile(
        path.join(dateDir, PARTIAL),
        JSON.stringify({ processedData }, null, 2),
        'utf8'
      );
    }

    const generator = new HtmlGenerator();
    let htmlGenQuiet = false;
    const regenerateHtml = async () => {
      const unified = this.formatUnifiedData(processedData, dateIso);
      await generator.generate(unified, {
        dateDir,
        site: this.config.site,
        dateKey,
        incremental: true,
        quiet: htmlGenQuiet
      });
    };

    await regenerateHtml();

    const tasks = [];

    processedData.web.forEach((block, si) => {
      (block.articles || []).forEach((_, ai) => {
        tasks.push({ kind: 'article', channel: 'web', skillKey: 'web', si, ai });
      });
    });
    processedData.rss.forEach((block, si) => {
      (block.articles || []).forEach((_, ai) => {
        tasks.push({ kind: 'article', channel: 'rss', skillKey: 'rss', si, ai });
      });
    });
    processedData.github.forEach((block, si) => {
      (block.projects || []).forEach((_, ai) => {
        tasks.push({ kind: 'github', si, ai });
      });
    });

    const liveTty = new LiveTty(concurrency);
    const pipelineWarn = msg => {
      if (liveTty.isActive) liveTty.noteWarning(msg);
      else logger.warn(msg);
    };
    const workerLines = new Array(concurrency).fill('(idle)');
    let liveRefreshPending = false;
    const scheduleLiveRefresh = () => {
      if (!liveTty.isActive) return;
      if (liveRefreshPending) return;
      liveRefreshPending = true;
      setImmediate(() => {
        liveRefreshPending = false;
        liveTty.render(workerLines, {
          input: openai.getTokenUsage().promptTokens,
          output: openai.getTokenUsage().completionTokens,
          total: openai.getTokenUsage().totalTokens
        });
      });
    };

    if (liveTty.init()) {
      htmlGenQuiet = true;
      openai.setTokenUsageListener(scheduleLiveRefresh);
      scheduleLiveRefresh();
    }

    const savePartial = async () => {
      await fs.writeFile(
        path.join(dateDir, PARTIAL),
        JSON.stringify({ processedData }, null, 2),
        'utf8'
      );
    };

    const runArticle = async (task, workerId) => {
      const block = processedData[task.channel][task.si];
      const article = block.articles[task.ai];
      if (article._llmDone) return;

      const url = article.link;
      workerLines[workerId] = url ? url.slice(0, 140) : article.title?.slice(0, 140) || '(article)';
      scheduleLiveRefresh();

      try {
        const contentToSummarize = article.content || article.summary || article.title;
        const summary = await summarizeArticle(contentToSummarize, {
          openai,
          systemPrompt: skillPrompts[task.skillKey]
        });
        const titleZh = await translate(article.title || '', {
          openai,
          systemPrompt: skillPrompts.translation
        });
        const summaryZh = await translate(summary, {
          openai,
          systemPrompt: skillPrompts.translation
        });

        article.summary = summary;
        article.titleZh = titleZh;
        article.summaryZh = summaryZh;
        article._llmDone = true;

        if (url) {
          await cache.set(url);
        }
        await savePartial();
        await regenerateHtml();
      } catch (err) {
        pipelineWarn(`Article failed (${article.title}): ${err.message}`);
        article.error = err.message;
        article._llmDone = true;
        if (url) {
          await cache.set(url);
        }
        await savePartial();
        await regenerateHtml();
      }
    };

    const runGithub = async (task, workerId) => {
      const block = processedData.github[task.si];
      const project = block.projects[task.ai];
      if (project._llmDone) return;

      const url = project.link;
      workerLines[workerId] = url ? url.slice(0, 140) : project.name || '(github)';
      scheduleLiveRefresh();

      try {
        const gh = this.config.processing?.github ?? {};
        const summary = await summarizeGitHubProject(project, {
          openai,
          systemPrompt: skillPrompts.github,
          mcpMaxRounds: gh.mcp_max_rounds,
          mcpTimeoutMs: gh.mcp_timeout_ms,
          mcpMaxToolResultChars: gh.mcp_max_tool_result_chars
        });
        const summaryZh = await translate(summary, {
          openai,
          systemPrompt: skillPrompts.translation
        });

        project.summary = summary;
        project.summaryZh = summaryZh;
        project._llmDone = true;

        await savePartial();
        await regenerateHtml();
      } catch (err) {
        pipelineWarn(`GitHub project failed (${project.name}): ${err.message}`);
        project.error = err.message;
        project._llmDone = true;
        await savePartial();
        await regenerateHtml();
      }
    };

    let nextTask = 0;
    async function worker(workerId) {
      while (true) {
        const i = nextTask++;
        if (i >= tasks.length) {
          workerLines[workerId] = '(idle)';
          scheduleLiveRefresh();
          return;
        }
        const task = tasks[i];
        if (task.kind === 'article') {
          await runArticle(task, workerId);
        } else {
          await runGithub(task, workerId);
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, (_, w) => worker(w)));

    if (liveTty.isActive) {
      openai.setTokenUsageListener(null);
      liveTty.render(workerLines, {
        input: openai.getTokenUsage().promptTokens,
        output: openai.getTokenUsage().completionTokens,
        total: openai.getTokenUsage().totalTokens
      });
      liveTty.done();
      for (const w of liveTty.takeDeferredWarns()) {
        logger.warn(w);
      }
    }

    await fs.writeFile(
      path.join(dateDir, RUN_META),
      JSON.stringify({ completed: true, date: dateKey }, null, 2),
      'utf8'
    );

    const unifiedData = this.formatUnifiedData(processedData, dateIso);
    await fs.writeFile(
      path.join(dateDir, RAW_DATA),
      JSON.stringify(unifiedData, null, 2),
      'utf8'
    );

    logger.info('Pipeline completed successfully');
    return unifiedData;
  }
}

export default NewsPipeline;
