import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import Logger from '../../utils/logger.js';
import { articleRecencyMaxAgeMs } from '../../utils/date.js';

const logger = new Logger('rss-source');

const parser = new Parser();

/** Default RSS recency window when caller does not pass `maxAgeMs` (matches config default: 2 days). */
export const RSS_DEFAULT_MAX_AGE_MS = articleRecencyMaxAgeMs(2);

/**
 * Keep RSS items whose pubDate is within the last `maxAgeMs` of `now`.
 * Items without a parseable pubDate are dropped (strict).
 * @param {Array<object>} items - rss-parser items
 * @param {Date} now
 * @param {number} maxAgeMs
 * @returns {Array<object>}
 */
export function filterRssItemsByRecency(items, now, maxAgeMs = RSS_DEFAULT_MAX_AGE_MS) {
  const cutoff = now.getTime() - maxAgeMs;
  const kept = [];

  for (const item of items) {
    const raw = item.pubDate || item.isoDate;
    if (!raw) {
      logger.debug(`RSS skip item without pubDate: ${item.title || item.link || '?'}`);
      continue;
    }
    const t = Date.parse(raw);
    if (Number.isNaN(t)) {
      logger.debug(`RSS skip item with invalid pubDate "${raw}": ${item.title || item.link || '?'}`);
      continue;
    }
    if (t < cutoff) {
      continue;
    }
    kept.push(item);
  }

  return kept;
}

async function parseFeed(feedUrl) {
  logger.info(`Parsing RSS feed: ${feedUrl}`);
  try {
    const feed = await parser.parseURL(feedUrl);
    logger.debug(`Successfully parsed RSS feed: ${feedUrl}`);
    return feed;
  } catch (error) {
    logger.error(`Failed to parse feed ${feedUrl}: ${error.message}`);
    throw new Error(`Failed to parse feed ${feedUrl}: ${error.message}`);
  }
}

async function extractArticleContent(articleUrl) {
  logger.debug(`Extracting content from: ${articleUrl}`);
  try {
    const response = await fetch(articleUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch article ${articleUrl}: ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    const selectors = [
      'article',
      'main',
      '.post-content',
      '.article-content',
      '#content',
      'body'
    ];

    let content = '';
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.html();
        break;
      }
    }

    logger.debug(`Successfully extracted content from: ${articleUrl}`);
    return content || html;
  } catch (error) {
    logger.warn(`Failed to extract content from ${articleUrl}: ${error.message}`);
    return '';
  }
}

/**
 * Collects articles from an RSS source (only entries within `maxRecencyDays` by pubDate).
 * @param {object} source - { name, url, max_items? }
 * @param {object} [options]
 * @param {number} [options.maxRecencyDays=2] - drop items older than this many days (by pubDate)
 * @returns {Promise<Array<object>>}
 */
async function collectRssArticles(source, options = {}) {
  const maxRecencyDays = options.maxRecencyDays ?? 2;
  const maxAgeMs = articleRecencyMaxAgeMs(maxRecencyDays);

  logger.info(`Collecting RSS articles from: ${source.name}`);
  const { name, url } = source;
  const maxItems = source.max_items ?? 50;
  const feed = await parseFeed(url);
  const now = new Date();

  const recent = filterRssItemsByRecency(feed.items || [], now, maxAgeMs);

  const slice = recent.slice(0, maxItems);

  const articles = [];
  for (const item of slice) {
    logger.debug(`Processing RSS article: ${item.title}`);
    const article = {
      source: name,
      title: item.title,
      link: item.link,
      pubDate: item.pubDate || item.isoDate,
      summary: item.contentSnippet || item.summary,
      content: await extractArticleContent(item.link)
    };
    articles.push(article);
  }

  logger.info(`Collected ${articles.length} RSS articles from: ${source.name}`);
  return articles;
}

export { parseFeed, extractArticleContent, collectRssArticles };
export default collectRssArticles;
