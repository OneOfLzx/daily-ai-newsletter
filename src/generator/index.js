// HTML Content Generator for Daily AI Newsletter
import MarkdownIt from 'markdown-it';
import Logger from '../utils/logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir } from '../utils/path.js';
import { rootLandingRedirectHtml } from '../utils/root-index.js';

const logger = new Logger('generator');

const summaryMarkdown = new MarkdownIt({
  html: false,
  linkify: true,
});

function fillTemplate(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    const token = `{{${key}}}`;
    out = out.split(token).join(value);
  }
  return out;
}

export class HtmlGenerator {
  constructor() {
    logger.info('HtmlGenerator initialized');
    this.htmlTemplate = `<!DOCTYPE html>
<html lang="{{lang}}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <meta name="theme-color" content="#2563eb">
    <title>{{pageTitle}}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        .toolbar { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .toolbar a { color: #2563eb; text-decoration: none; font-size: 0.95rem; }
        .toolbar a:hover { text-decoration: underline; }
        .main-title, .date-line { text-align: center; font-size: 2rem; font-weight: 700; color: #2563eb; margin-bottom: 8px; }
        .date-line { color: #1e293b; font-weight: 600; margin-bottom: 32px; }
        .source-section { margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 8px; }
        .source-title { font-size: 1.5rem; margin-bottom: 20px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
        .news-item { margin-bottom: 20px; padding: 15px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .news-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; }
        .news-title a { color: #2563eb; text-decoration: none; }
        .news-title a:hover { text-decoration: underline; }
        .news-summary { color: #64748b; font-size: 0.95rem; }
        .news-summary :first-child { margin-top: 0; }
        .news-summary :last-child { margin-bottom: 0; }
        .news-summary p { margin: 0.5em 0; }
        .news-summary h1, .news-summary h2, .news-summary h3, .news-summary h4 { font-size: 1.05rem; font-weight: 600; color: #334155; margin: 0.75em 0 0.35em; line-height: 1.35; }
        .news-summary h1:first-child, .news-summary h2:first-child, .news-summary h3:first-child { margin-top: 0; }
        .news-summary ul, .news-summary ol { margin: 0.5em 0; padding-left: 1.25rem; }
        .news-summary li { margin: 0.2em 0; }
        .news-summary strong { color: #475569; font-weight: 600; }
        .news-summary hr { border: none; border-top: 1px solid #e2e8f0; margin: 0.75rem 0; }
        .news-summary a { color: #2563eb; }
        .news-summary a:hover { text-decoration: underline; }
        .news-summary code { font-size: 0.9em; background: #f1f5f9; padding: 0.15em 0.35em; border-radius: 4px; }
        .news-summary pre { background: #f1f5f9; padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 0.85em; margin: 0.5em 0; }
        .news-summary pre code { background: none; padding: 0; }
        .news-summary blockquote { margin: 0.5em 0; padding-left: 0.75rem; border-left: 3px solid #cbd5e1; color: #64748b; }
    </style>
</head>
<body>
    <div class="toolbar">{{toolbarLinks}}</div>
    <h1 class="main-title">{{title}}</h1>
    <p class="date-line">{{timestamp}}</p>
    <div id="content">
        {{content}}
    </div>
</body>
</html>`;
  }

  generateNewsItem(item, type, lang) {
    logger.debug(`Generating news item for type: ${type}, language: ${lang}`);
    let title;
    let link;
    let summary;

    if (type === 'github') {
      title = item.name;
      link = item.link;
      if (lang === 'en') {
        summary = item.summary || item.description || '';
      } else {
        summary = item.summaryZh || item.summary || item.description || '';
      }
    } else {
      if (lang === 'en') {
        title = item.title;
        summary = item.summary || '';
      } else {
        title = item.titleZh || item.title;
        summary = item.summaryZh || item.summary || '';
      }
      link = item.link;
    }

    return `
<div class="news-item">
    <div class="news-title"><a href="${link}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(title)}</a></div>
    <div class="news-summary">${this.renderSummaryHtml(summary)}</div>
</div>`;
  }

  sectionHeading(source) {
    if (source.type === 'github') {
      return `GitHub - ${source.name}`;
    }
    return source.name;
  }

  generateSourceSection(source, lang) {
    logger.debug(`Generating source section for: ${source.name}, language: ${lang}`);
    const itemsHtml = source.items
      .filter(item => !item.error)
      .map(item => this.generateNewsItem(item, source.type, lang))
      .join('');

    const heading = this.sectionHeading(source);

    return `
<div class="source-section">
    <h2 class="source-title">${this.escapeHtml(heading)}</h2>
    ${itemsHtml}
</div>`;
  }

  renderSummaryHtml(text) {
    if (typeof text !== 'string' || !text.trim()) {
      return '';
    }
    return summaryMarkdown.render(text);
  }

  /**
   * @param {object} unifiedData
   * @param {object} [options]
   * @param {string} [options.dateDir] - output directory for this edition (public/YYYY-MM-DD); root `index.html` is written to cwd
   * @param {string} [options.dateKey] - YYYY-MM-DD
   * @param {object} [options.site] - { github_repo_url? }
   * @param {boolean} [options.incremental] - if true, do not write raw-data.json (pipeline writes final)
   * @param {boolean} [options.quiet] - if true, skip routine info logs (used while TUI dashboard is active)
   */
  async generate(unifiedData, options = {}) {
    const quiet = options.quiet === true;
    if (!quiet) {
      logger.info('Generating HTML newsletter for both languages');
    }

    const allSources = [
      ...unifiedData.sources.web,
      ...unifiedData.sources.rss,
      ...unifiedData.sources.github
    ];

    const date = new Date(unifiedData.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStrFromTs = `${year}-${month}-${day}`;

    const dateStr = options.dateKey || dateStrFromTs;
    const publicDir = path.resolve(process.cwd(), 'public');
    const dateOutputDir = options.dateDir || path.join(publicDir, dateStr);
    const rawDataOutputPath = path.join(dateOutputDir, 'raw-data.json');
    const incremental = options.incremental === true;
    const site = options.site || {};
    const gh = typeof site.github_repo_url === 'string' ? site.github_repo_url.trim() : '';

    await ensureDir(dateOutputDir);

    if (!incremental) {
      if (!quiet) {
        logger.info(`Writing raw data to ${rawDataOutputPath}`);
      }
      await fs.writeFile(rawDataOutputPath, JSON.stringify(unifiedData, null, 2), 'utf-8');
    }

    const results = {};

    for (const lang of ['en', 'zh']) {
      const contentHtml = allSources
        .filter(source => source.items && source.items.length > 0)
        .map(source => this.generateSourceSection(source, lang))
        .join('');

      let formattedDate;
      let title;
      let pageTitle;
      let langLabel;
      let otherFile;

      if (lang === 'en') {
        formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        });
        title = 'Daily AI Newsletter';
        pageTitle = `${title} — ${formattedDate}`;
        langLabel = '中文';
        otherFile = 'index.zh.html';
      } else {
        formattedDate = date.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        });
        title = '每日AI简讯';
        pageTitle = `${title} — ${formattedDate}`;
        langLabel = 'English';
        otherFile = 'index.en.html';
      }

      const parts = [`<a href="${otherFile}">${langLabel}</a>`];
      if (gh) {
        parts.push(`<a href="${gh}" target="_blank" rel="noopener noreferrer">GitHub</a>`);
      }
      const toolbarLinks = parts.join(' · ');

      const html = fillTemplate(this.htmlTemplate, {
        lang,
        pageTitle: this.escapeHtml(pageTitle),
        title: this.escapeHtml(title),
        timestamp: this.escapeHtml(formattedDate),
        content: contentHtml,
        toolbarLinks
      });

      const htmlOutputPath = path.join(dateOutputDir, `index.${lang}.html`);
      if (!quiet) {
        logger.info(`Writing HTML output to ${htmlOutputPath}`);
      }
      await fs.writeFile(htmlOutputPath, html, 'utf-8');

      results[lang] = html;
    }

    const rootIndex = path.join(process.cwd(), 'index.html');
    await fs.writeFile(rootIndex, rootLandingRedirectHtml(dateStr), 'utf-8');

    if (!quiet) {
      logger.info('HTML newsletters saved successfully');
    }
    return results;
  }
}

HtmlGenerator.prototype.escapeHtml = function (text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export default HtmlGenerator;
