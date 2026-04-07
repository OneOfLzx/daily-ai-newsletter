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

function slugifyId(text) {
  const s = String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'source';
}

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
<html lang="{{lang}}" class="sidebar-closed">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <meta name="theme-color" content="#2563eb">
    <title>{{pageTitle}}</title>
    <script>
        (() => {
            try {
                const d = document.documentElement;
                const isDesktop = window.matchMedia && window.matchMedia('(min-width: 768px)').matches;
                d.classList.toggle('sidebar-open', !!isDesktop);
                d.classList.toggle('sidebar-closed', !isDesktop);
            } catch {}
        })();
    </script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; background: #ffffff; }

        .page-shell { position: relative; display: flex; justify-content: center; align-items: flex-start; gap: 24px; padding: 20px; }
        .main { width: min(800px, 100%); }

        .fab-toc { position: fixed; top: 16px; left: 16px; z-index: 60; display: inline-flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 999px; border: 1px solid rgba(15, 23, 42, 0.14); background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); color: #0f172a; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12); cursor: pointer; font-weight: 600; }
        .fab-toc:hover { background: rgba(255,255,255,0.98); }
        .fab-toc:active { transform: translateY(1px); }
        .fab-toc .icon { font-size: 16px; line-height: 1; }

        .sidebar { width: 260px; flex: 0 0 260px; position: fixed; top: 0; left: 0; height: 100vh; max-height: 100vh; overflow-y: auto; overflow-x: hidden; padding: 14px; border-radius: 0; background: #ffffff; border: none; border-right: 1px solid #e2e8f0; z-index: 55; }
        .sidebar-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .sidebar .sidebar-title { font-weight: 800; color: #0f172a; letter-spacing: 0.2px; }
        .sidebar-close { display: none; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; border: 1px solid rgba(15, 23, 42, 0.14); background: rgba(255,255,255,0.9); color: #0f172a; cursor: pointer; }
        .sidebar-close:hover { background: rgba(255,255,255,0.98); }
        .toc { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
        .toc a { display: block; padding: 8px 10px; border-radius: 8px; color: #1e293b; text-decoration: none; font-size: 0.95rem; border: 1px solid transparent; }
        .toc a:hover { background: rgba(37, 99, 235, 0.06); border-color: rgba(37, 99, 235, 0.18); }

        /* Hide scrollbar when idle (show on hover for WebKit). */
        .sidebar { scrollbar-width: none; }
        .sidebar::-webkit-scrollbar { width: 0; height: 0; }
        .sidebar:hover { scrollbar-width: thin; }
        .sidebar:hover::-webkit-scrollbar { width: 10px; }
        .sidebar:hover::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.18); border-radius: 999px; border: 3px solid transparent; background-clip: content-box; }
        .sidebar:hover::-webkit-scrollbar-track { background: transparent; }

        .sidebar-mask { display: none; }
        .sidebar-closed .sidebar { display: none; }

        @media (min-width: 768px) {
            .sidebar-open .page-shell { padding-left: 280px; }
            .sidebar-open .fab-toc { left: 276px; }
            .sidebar-close { display: none; }
        }

        .main-title, .date-line { text-align: center; font-size: 2rem; font-weight: 700; color: #2563eb; margin-bottom: 8px; }
        .date-line { color: #1e293b; font-weight: 600; margin-bottom: 10px; }

        .action-row { display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 28px; }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 9px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; text-decoration: none; font-size: 0.95rem; font-weight: 700; }
        .btn svg { flex: 0 0 auto; }
        .btn:hover { background: #f8fafc; }
        .btn:active { transform: translateY(1px); }
        .btn-github { background: #0b1220; border-color: #0b1220; color: #ffffff; }
        .btn-github:hover { background: #111a2d; }
        .btn-secondary { border-color: #e2e8f0; background: #f8fafc; color: #0f172a; }
        .btn-secondary:hover { background: #eef2f7; }

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

        .collapse-btn-row { margin-top: 6px; display: flex; justify-content: center; }
        .toggle-items { cursor: pointer; border: 1px solid #e2e8f0; background: #ffffff; color: #0f172a; padding: 8px 10px; border-radius: 10px; font-weight: 700; }
        .toggle-items:hover { background: #f8fafc; }
        .items-hidden { display: none; }
        .source-section.is-expanded .items-hidden { display: block; }

        @media (max-width: 767px) {
            .page-shell { padding: 16px; }
            .fab-toc { top: 12px; left: 12px; padding: 10px 12px; }
            .sidebar-open .fab-toc { display: none; }
            .sidebar { width: 84vw; max-width: 320px; z-index: 70; transform: translateX(-102%); transition: transform 160ms ease-out; }
            .sidebar-mask { position: fixed; inset: 0; z-index: 65; background: rgba(2, 6, 23, 0.35); opacity: 0; pointer-events: none; transition: opacity 160ms ease-out; }

            .sidebar-open .sidebar { display: block; transform: translateX(0); }
            .sidebar-open .sidebar-mask { display: block; opacity: 1; pointer-events: auto; }
            .sidebar-open .sidebar-close { display: inline-flex; }
        }
    </style>
</head>
<body>
    <button class="fab-toc" type="button" id="tocToggle" aria-label="Toggle table of contents">
        <span class="icon">☰</span>
        <span>{{tocLabel}}</span>
    </button>
    <div class="sidebar-mask" id="sidebarMask" aria-hidden="true"></div>
    <div class="page-shell">
        <aside class="sidebar" id="sidebar" aria-label="Table of contents">
            <div class="sidebar-top">
                <div class="sidebar-title">{{tocTitle}}</div>
                <button class="sidebar-close" type="button" id="sidebarClose" aria-label="Close sidebar">✕</button>
            </div>
            <ul class="toc">
                {{tocItems}}
            </ul>
        </aside>
        <main class="main">
            <h1 class="main-title">{{title}}</h1>
            <p class="date-line">{{timestamp}}</p>
            <div class="action-row">{{actionLinks}}</div>
            <div id="content">
                {{content}}
            </div>
        </main>
    </div>

    <script>
        (() => {
            const d = document.documentElement;
            const btn = document.getElementById('tocToggle');
            const mask = document.getElementById('sidebarMask');
            const closeBtn = document.getElementById('sidebarClose');

            const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
            const setSidebarOpen = (open) => {
                d.classList.toggle('sidebar-open', !!open);
                d.classList.toggle('sidebar-closed', !open);
            };

            btn?.addEventListener('click', () => {
                const open = d.classList.contains('sidebar-open');
                setSidebarOpen(!open);
            });
            mask?.addEventListener('click', () => setSidebarOpen(false));
            closeBtn?.addEventListener('click', () => setSidebarOpen(false));

            document.addEventListener('click', (e) => {
                const a = e.target && e.target.closest ? e.target.closest('a[data-toc-link]') : null;
                if (!a) return;
                if (isMobile()) setSidebarOpen(false);
            });

            document.addEventListener('click', (e) => {
                const btn = e.target && e.target.closest ? e.target.closest('button[data-toggle-items]') : null;
                if (!btn) return;
                const section = btn.closest('.source-section');
                if (!section) return;
                const expanded = section.classList.toggle('is-expanded');
                const labelMore = btn.getAttribute('data-label-more') || '';
                const labelLess = btn.getAttribute('data-label-less') || '';
                btn.textContent = expanded ? labelLess : labelMore;
            });
        })();
    </script>
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

  generateSourceSection(source, lang, opts = {}) {
    logger.debug(`Generating source section for: ${source.name}, language: ${lang}`);
    const anchorId = typeof opts.anchorId === 'string' && opts.anchorId ? opts.anchorId : undefined;
    const maxVisible = Number.isInteger(opts.maxVisible) && opts.maxVisible > 0 ? opts.maxVisible : 20;

    const renderedItems = source.items
      .filter(item => !item.error)
      .map(item => this.generateNewsItem(item, source.type, lang))
      .filter(Boolean);

    const heading = this.sectionHeading(source);

    const hasOverflow = renderedItems.length > maxVisible;
    const visibleItems = hasOverflow ? renderedItems.slice(0, maxVisible).join('') : renderedItems.join('');
    const hiddenItems = hasOverflow ? renderedItems.slice(maxVisible).join('') : '';

    const overflowN = hasOverflow ? renderedItems.length - maxVisible : 0;
    const labelMore = lang === 'zh' ? `展开全部（${overflowN}）` : `Show all (${overflowN})`;
    const labelLess = lang === 'zh' ? '收起' : 'Show less';

    return `
<div class="source-section"${anchorId ? ` id="${this.escapeHtml(anchorId)}"` : ''}>
    <h2 class="source-title">${this.escapeHtml(heading)}</h2>
    <div class="items-visible">
        ${visibleItems}
    </div>
    ${hasOverflow ? `<div class="items-hidden">
        ${hiddenItems}
    </div>
    <div class="collapse-btn-row">
        <button class="toggle-items" type="button" data-toggle-items="1" data-label-more="${this.escapeHtml(labelMore)}" data-label-less="${this.escapeHtml(labelLess)}">${this.escapeHtml(labelMore)}</button>
    </div>` : ''}
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
    const ui = options.ui && typeof options.ui === 'object' ? options.ui : {};
    const maxVisible = Number.isInteger(ui.max_visible_items_per_source) && ui.max_visible_items_per_source > 0
      ? ui.max_visible_items_per_source
      : 20;

    await ensureDir(dateOutputDir);

    if (!incremental) {
      if (!quiet) {
        logger.info(`Writing raw data to ${rawDataOutputPath}`);
      }
      await fs.writeFile(rawDataOutputPath, JSON.stringify(unifiedData, null, 2), 'utf-8');
    }

    const results = {};

    for (const lang of ['en', 'zh']) {
      const sourcesWithItems = allSources
        .filter(source => source.items && source.items.filter(item => !item.error).length > 0)
        .map((source, idx) => {
          const heading = this.sectionHeading(source);
          const anchorId = `source-${slugifyId(heading)}-${idx + 1}`;
          return { source, heading, anchorId };
        });

      const contentHtml = sourcesWithItems
        .map(({ source, anchorId }) =>
          this.generateSourceSection(source, lang, { anchorId, maxVisible })
        )
        .join('');

      let formattedDate;
      let title;
      let pageTitle;
      let langLabel;
      let otherFile;
      let tocTitle;
      let tocLabel;
      let archiveLabel;

      if (lang === 'en') {
        formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        });
        title = 'Daily AI Newsletter';
        pageTitle = `${title} — ${formattedDate}`;
        langLabel = '切换到中文';
        otherFile = 'index.zh.html';
        tocTitle = 'Contents';
        tocLabel = 'Contents';
        archiveLabel = 'Archive';
      } else {
        formattedDate = date.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        });
        title = '每日AI简讯';
        pageTitle = `${title} — ${formattedDate}`;
        langLabel = 'Switch to English';
        otherFile = 'index.en.html';
        tocTitle = '目录';
        tocLabel = '目录';
        archiveLabel = '历史归档';
      }

      const githubIcon = `<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="display:block"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"></path></svg>`;

      const actionParts = [
        `<a class="btn btn-secondary" href="${otherFile}">${langLabel}</a>`,
        `<a class="btn" href="../archive/index.html">${archiveLabel}</a>`
      ];
      if (gh) {
        actionParts.push(
          `<a class="btn btn-github" href="${gh}" target="_blank" rel="noopener noreferrer">${githubIcon}<span>GitHub</span></a>`
        );
      }
      const actionLinks = actionParts.join('');

      const tocItems = sourcesWithItems
        .map(({ heading, anchorId }) => {
          return `<li><a data-toc-link="1" href="#${this.escapeHtml(anchorId)}">${this.escapeHtml(heading)}</a></li>`;
        })
        .join('');

      const html = fillTemplate(this.htmlTemplate, {
        lang,
        pageTitle: this.escapeHtml(pageTitle),
        title: this.escapeHtml(title),
        timestamp: this.escapeHtml(formattedDate),
        content: contentHtml,
        actionLinks,
        tocItems,
        tocTitle: this.escapeHtml(tocTitle),
        tocLabel: this.escapeHtml(tocLabel)
      });

      const htmlOutputPath = path.join(dateOutputDir, `index.${lang}.html`);
      if (!quiet) {
        logger.info(`Writing HTML output to ${htmlOutputPath}`);
      }
      await fs.writeFile(htmlOutputPath, html, 'utf-8');

      results[lang] = html;
    }

    await this.generateArchiveIndex(publicDir);

    const rootIndex = path.join(process.cwd(), 'index.html');
    await fs.writeFile(rootIndex, rootLandingRedirectHtml(dateStr), 'utf-8');

    if (!quiet) {
      logger.info('HTML newsletters saved successfully');
    }
    return results;
  }

  async generateArchiveIndex(publicDir) {
    const archiveDir = path.join(publicDir, 'archive');
    const archivePath = path.join(archiveDir, 'index.html');
    await ensureDir(archiveDir);

    let entries = [];
    try {
      entries = await fs.readdir(publicDir, { withFileTypes: true });
    } catch {
      entries = [];
    }
    const dateDirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

    const links = dateDirs
      .map(d => `<div class="row"><a href="../${d}/index.en.html">${d}</a></div>`)
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <meta name="theme-color" content="#0b1220">
  <title>Daily AI Newsletter — Archive</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #0f172a; background: #ffffff; padding: 24px; }
    .wrap { max-width: 820px; margin: 0 auto; }
    h1 { text-align: center; font-size: 2.2rem; font-weight: 800; color: #2563eb; margin: 10px 0 18px; }
    .hint { text-align: center; color: #475569; margin-bottom: 22px; }
    .list { display: grid; gap: 10px; }
    .row a { display: block; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 12px; text-decoration: none; color: #0f172a; background: #f8fafc; font-weight: 700; }
    .row a:hover { background: #eef2f7; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Daily AI Newsletter</h1>
    <div class="hint">Archive (newest to oldest)</div>
    <div class="list">
      ${links || '<div class="row"><a href="../index.en.html">No editions found</a></div>'}
    </div>
  </div>
</body>
</html>`;

    await fs.writeFile(archivePath, html, 'utf-8');
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
