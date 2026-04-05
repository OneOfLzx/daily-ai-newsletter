import * as cheerio from 'cheerio';
import Logger from '../../utils/logger.js';

const logger = new Logger('github-source');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchTrendshiftHTML() {
  logger.info('Fetching trendshift.io HTML');
  const response = await fetch('https://trendshift.io', {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  });

  if (!response.ok) {
    logger.error(`Failed to fetch trendshift.io: ${response.statusText}`);
    throw new Error(`Failed to fetch trendshift.io: ${response.statusText}`);
  }

  logger.debug('Successfully fetched trendshift.io HTML');
  return response.text();
}

function extractProjects(html) {
  logger.debug('Extracting GitHub projects from HTML');
  const $ = cheerio.load(html);
  const projects = [];
  const seen = new Set();

  $('a[href^="https://github.com/"]').each((index, element) => {
    const $el = $(element);
    const href = $el.attr('href');
    if (!href) return;

    const repoMatch = href.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/);
    if (!repoMatch) return;

    const name = repoMatch[1];
    if (seen.has(name)) return;
    seen.add(name);

    let description = '';
    const $parent = $el.parent();
    const $desc = $parent.find('p').first() || $parent.next('p').first() || $parent.parent().find('p').first();
    if ($desc.length) {
      description = $desc.text().trim();
    }

    projects.push({
      name,
      description,
      link: href
    });
  });

  const result = projects.slice(0, 20);
  logger.debug(`Extracted ${result.length} GitHub projects`);
  return result;
}

export class GitHubTrendsCollector {
  constructor(config = {}) {
    this.config = config;
  }

  async collectTrendingProjects() {
    logger.info('Collecting GitHub trending projects');
    try {
      const html = await fetchTrendshiftHTML();
      const projects = extractProjects(html);
      logger.info(`Collected ${projects.length} GitHub trending projects`);
      return projects;
    } catch (err) {
      logger.error(`Failed to collect GitHub trending projects: ${err.message}`);
      return [];
    }
  }

  async scrapeSource(source) {
    logger.debug(`Scraping GitHub source: ${source.name}`);
    return this.collectTrendingProjects();
  }

  async scrapeAll(sources) {
    logger.info(`Scraping ${sources.length} GitHub sources`);
    const allResults = [];
    for (const source of sources) {
      const projects = await this.scrapeSource(source);
      allResults.push({
        source: source.name || 'GitHub Trending',
        projects
      });
    }
    logger.info('GitHub scraping completed');
    return allResults;
  }
}

export {
  fetchTrendshiftHTML,
  extractProjects
};

export default GitHubTrendsCollector;
