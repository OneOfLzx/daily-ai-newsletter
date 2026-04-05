import * as cheerio from 'cheerio';
import Logger from '../../utils/logger.js';
import { formatLocalYyyyMmDd } from '../../utils/date.js';

const logger = new Logger('web-source');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

const TLDR_HOST = 'tldr.tech';
/** Minimum unique external links to treat a TLDR dated edition page as "real" content vs signup landing. */
const TLDR_MIN_EXTERNAL_LINKS = 8;
const MAX_ARTICLE_TEXT_CHARS = 14000;

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(minMs = 1000, maxMs = 2000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { formatLocalYyyyMmDd };

/**
 * @param {string} baseUrl e.g. https://tldr.tech/ai/
 * @param {string} yyyyMmDd
 */
export function buildTldrDatedListingUrl(baseUrl, yyyyMmDd) {
  const u = baseUrl.trim().replace(/\/+$/, '');
  return `${u}/${yyyyMmDd}`;
}

export function isTldrSourceUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === TLDR_HOST || host.endsWith(`.${TLDR_HOST}`);
  } catch {
    return false;
  }
}

/**
 * Unique external (non-TLDR) http(s) links — used to detect real newsletter HTML vs placeholder.
 * @param {string} html
 */
export function countTldrExternalArticleLinks(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || !/^https?:\/\//i.test(href)) return;
    try {
      const u = new URL(href);
      if (u.hostname.toLowerCase().endsWith(TLDR_HOST)) return;
    } catch {
      return;
    }
    if (/mailto:/i.test(href)) return;
    seen.add(href.split('#')[0]);
  });
  return seen.size;
}

/**
 * @param {string} html
 */
export function isValidTldrEditionPage(html) {
  return countTldrExternalArticleLinks(html) >= TLDR_MIN_EXTERNAL_LINKS;
}

/**
 * Extract outbound article links from a TLDR daily edition page.
 * @param {string} html
 * @returns {Array<{ title: string, link: string }>}
 */
export function extractTldrArticleLinks(html) {
  const $ = cheerio.load(html);
  const articles = [];
  const seen = new Set();

  const skipTitle = t => {
    const x = t.toLowerCase();
    return (
      x.length < 8 ||
      x === 'read more' ||
      x === 'read on' ||
      x.includes('sign up') ||
      x.includes('subscribe') ||
      x.includes('advertise') ||
      x.includes('privacy') ||
      x.includes('careers')
    );
  };

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || !/^https?:\/\//i.test(href)) return;
    let u;
    try {
      u = new URL(href);
    } catch {
      return;
    }
    if (u.hostname.toLowerCase().endsWith(TLDR_HOST)) return;
    if (/mailto:/i.test(href)) return;

    const key = href.split('#')[0];
    if (seen.has(key)) return;

    let title = $(el).text().replace(/\s+/g, ' ').trim();
    if (skipTitle(title)) return;

    seen.add(key);
    articles.push({ title, link: href });
  });

  return articles;
}

/**
 * @param {string} html
 * @param {object} selectors
 */
function extractArticleLinks(html, selectors = {}) {
  logger.debug('Extracting article links (generic)');
  const $ = cheerio.load(html);
  const articles = [];
  const linkSelector = selectors.link || 'a[href]';
  const titleSelector = selectors.title || '';

  $(linkSelector).each((index, element) => {
    const $el = $(element);
    let title = titleSelector ? $el.find(titleSelector).text().trim() : $el.text().trim();
    let link = $el.attr('href');

    if (link && !link.startsWith('http')) {
      try {
        const url = new URL(link, 'https://tldr.tech');
        link = url.href;
      } catch {
        return;
      }
    }

    if (title && link) {
      articles.push({ title, link });
    }
  });

  const uniqueArticles = [];
  const seenLinks = new Set();
  for (const article of articles) {
    if (!seenLinks.has(article.link)) {
      seenLinks.add(article.link);
      uniqueArticles.push(article);
    }
  }

  logger.debug(`Extracted ${uniqueArticles.length} unique article links`);
  return uniqueArticles;
}

function extractArticleContent(html, selectors = {}) {
  logger.debug('Extracting article content');
  const $ = cheerio.load(html);
  const contentSelector = selectors.content || 'body';
  $('script, style, noscript').remove();
  let text = $(contentSelector).text().trim().replace(/\s+/g, ' ');
  if (text.length > MAX_ARTICLE_TEXT_CHARS) {
    text = text.slice(0, MAX_ARTICLE_TEXT_CHARS);
  }
  return text;
}

async function fetchHTML(url) {
  logger.debug(`Fetching HTML from ${url}`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': getRandomUserAgent(),
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  });

  if (!response.ok) {
    logger.error(`Failed to fetch ${url}: ${response.statusText}`);
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  logger.debug(`Successfully fetched HTML from ${url}`);
  return response.text();
}

/**
 * Try base URL + local dates from today going back (inclusive).
 * @param {object} source
 * @returns {Promise<{ listUrl: string, listHtml: string } | null>}
 */
export async function resolveTldrListingPage(source) {
  const { url: baseUrl } = source;
  const maxDays = source.max_date_backtrack_days ?? 7;
  const now = new Date();

  for (let back = 0; back < maxDays; back++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const ymd = formatLocalYyyyMmDd(d);
    const listUrl = buildTldrDatedListingUrl(baseUrl, ymd);
    try {
      logger.debug(`TLDR try listing URL: ${listUrl}`);
      const listHtml = await fetchHTML(listUrl);
      if (isValidTldrEditionPage(listHtml)) {
        logger.info(`TLDR using edition page: ${listUrl}`);
        return { listUrl, listHtml };
      }
      logger.debug(`TLDR page at ${listUrl} looks empty/placeholder, trying earlier day`);
    } catch (e) {
      logger.debug(`TLDR fetch failed for ${listUrl}: ${e.message}`);
    }
    if (back < maxDays - 1) {
      await sleep(400, 900);
    }
  }

  return null;
}

export class WebScraper {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * @param {object} source
   * @returns {Promise<Array<{ title: string, link: string, content: string }>>}
   */
  async scrapeSource(source) {
    logger.info(`Scraping web source: ${source.name}`);
    const { url, selectors = {} } = source;
    const results = [];

    try {
      let listHtml;
      let articles;

      if (isTldrSourceUrl(url)) {
        const resolved = await resolveTldrListingPage(source);
        if (!resolved) {
          logger.warn(`No valid TLDR edition found for ${source.name} within backtrack window`);
          return results;
        }
        listHtml = resolved.listHtml;
        articles = extractTldrArticleLinks(listHtml);
        logger.debug(`TLDR extracted ${articles.length} article link rows`);
      } else {
        listHtml = await fetchHTML(url);
        articles = extractArticleLinks(listHtml, selectors);
        logger.debug(`Found ${articles.length} articles for source ${source.name}`);
      }

      for (const article of articles) {
        try {
          logger.debug(`Scraping article: ${article.link}`);
          await sleep();
          const articleHtml = await fetchHTML(article.link);
          const content = extractArticleContent(articleHtml, selectors);

          results.push({
            ...article,
            content
          });
        } catch (err) {
          logger.warn(`Failed to scrape article ${article.link}: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`Failed to scrape source ${source.name}: ${err.message}`);
    }

    logger.info(`Scraped ${results.length} articles from ${source.name}`);
    return results;
  }

  async scrapeAll(sources) {
    logger.info(`Scraping ${sources.length} web sources`);
    const allResults = [];

    for (const source of sources) {
      const articles = await this.scrapeSource(source);
      allResults.push({
        source: source.name,
        articles
      });
    }

    logger.info('Web scraping completed');
    return allResults;
  }
}

export { fetchHTML, extractArticleLinks, extractArticleContent, sleep, getRandomUserAgent };

export default WebScraper;
