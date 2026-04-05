import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import Logger from '../utils/logger.js';
import { skillMdPath } from '../skills/prompts.js';

const logger = new Logger('config');

// Define configuration validation schemas
const WebSourceSchema = {
  required: ['name', 'url'],
  properties: {
    name: 'string',
    url: 'string',
    selectors: {
      title: 'string',
      link: 'string',
      content: 'string'
    }
  }
};

const RssSourceSchema = {
  required: ['name', 'url'],
  properties: {
    name: 'string',
    url: 'string'
  }
};

const GithubSourceSchema = {
  required: ['name', 'owner', 'repo'],
  properties: {
    name: 'string',
    owner: 'string',
    repo: 'string',
    branch: 'string',
    path: 'string'
  }
};

const LLMConfigSchema = {
  required: ['api_key'],
  properties: {
    api_key: 'string',
    base_url: 'string'
  }
};

// Main config validator
function validateConfig(config) {
  logger.info('Validating configuration...');
  
  // Validate LLM configuration
  if (!config.llm || typeof config.llm !== 'object') {
    logger.error('LLM configuration is required and must be an object');
    throw new Error('LLM configuration is required and must be an object');
  }
  if (!config.llm.api_key) {
    logger.error('LLM API key is required');
    throw new Error('LLM API key is required');
  }

  if (!config.skills || typeof config.skills !== 'object') {
    logger.error('skills configuration is required (web, rss, github, translation skill ids)');
    throw new Error('skills configuration is required');
  }
  const skillIds = ['web', 'rss', 'github', 'translation'];
  for (const key of skillIds) {
    const id = config.skills[key];
    if (!id || typeof id !== 'string' || !id.trim()) {
      logger.error(`skills.${key} must be a non-empty string (skill directory name)`);
      throw new Error(`skills.${key} must be set`);
    }
    const md = skillMdPath(id.trim());
    if (!fs.existsSync(md)) {
      logger.error(`Skill SKILL.md missing for skills.${key}="${id.trim()}" (${md})`);
      throw new Error(`Skill not found: ${id.trim()}`);
    }
  }

  if (config.site !== undefined) {
    if (typeof config.site !== 'object' || config.site === null) {
      logger.error('site must be an object when provided');
      throw new Error('site must be an object when provided');
    }
    if (
      config.site.github_repo_url !== undefined &&
      typeof config.site.github_repo_url !== 'string'
    ) {
      logger.error('site.github_repo_url must be a string when provided');
      throw new Error('site.github_repo_url must be a string when provided');
    }
  }

  if (config.processing !== undefined) {
    if (typeof config.processing !== 'object' || config.processing === null) {
      logger.error('processing must be an object when provided');
      throw new Error('processing must be an object when provided');
    }
    const c = config.processing.concurrency;
    if (c !== undefined) {
      if (!Number.isInteger(c) || c < 1) {
        logger.error('processing.concurrency must be a positive integer');
        throw new Error('processing.concurrency must be a positive integer');
      }
    }
    const recency = config.processing.max_article_recency_days;
    if (recency !== undefined) {
      if (!Number.isInteger(recency) || recency < 1) {
        logger.error('processing.max_article_recency_days must be a positive integer');
        throw new Error('processing.max_article_recency_days invalid');
      }
    }
    if (config.processing.github !== undefined) {
      if (typeof config.processing.github !== 'object' || config.processing.github === null) {
        logger.error('processing.github must be an object when provided');
        throw new Error('processing.github must be an object when provided');
      }
      const gh = config.processing.github;
      const checkInt = (key, min = 1) => {
        const v = gh[key];
        if (v === undefined) return;
        if (!Number.isInteger(v) || v < min) {
          logger.error(`processing.github.${key} must be an integer >= ${min}`);
          throw new Error(`processing.github.${key} invalid`);
        }
      };
      checkInt('mcp_max_rounds', 1);
      checkInt('mcp_timeout_ms', 1000);
      checkInt('mcp_max_tool_result_chars', 1024);
    }
  }

  const sources = config.sources || {};
  
  // Forbid email sources as per requirements
  if (sources.email && Array.isArray(sources.email)) {
    logger.error('Email data sources are not supported');
    throw new Error('Email data sources are not supported');
  }

  // Validate web sources if present
  if (sources.web) {
    if (!Array.isArray(sources.web)) {
      logger.error('Web sources must be an array');
      throw new Error('Web sources must be an array');
    }
    sources.web.forEach((source, idx) => {
      if (!source.name || !source.url) {
        logger.error(`Web source #${idx} missing name or URL`);
        throw new Error(`Web source #${idx} missing name or URL`);
      }
      if (source.max_date_backtrack_days !== undefined) {
        const n = source.max_date_backtrack_days;
        if (!Number.isInteger(n) || n < 1) {
          logger.error(`Web source #${idx} max_date_backtrack_days must be a positive integer`);
          throw new Error(`Web source #${idx} max_date_backtrack_days invalid`);
        }
      }
    });
  }

  // Validate RSS sources if present
  if (sources.rss) {
    if (!Array.isArray(sources.rss)) {
      logger.error('RSS sources must be an array');
      throw new Error('RSS sources must be an array');
    }
    sources.rss.forEach((source, idx) => {
      if (!source.name || !source.url) {
        logger.error(`RSS source #${idx} missing name or URL`);
        throw new Error(`RSS source #${idx} missing name or URL`);
      }
      if (source.max_items !== undefined) {
        const n = source.max_items;
        if (!Number.isInteger(n) || n < 1) {
          logger.error(`RSS source #${idx} max_items must be a positive integer`);
          throw new Error(`RSS source #${idx} max_items invalid`);
        }
      }
    });
  }

  // Validate GitHub sources if present
  if (sources.github) {
    if (!Array.isArray(sources.github)) {
      logger.error('GitHub sources must be an array');
      throw new Error('GitHub sources must be an array');
    }
    sources.github.forEach((source, idx) => {
      if (!source.name || !source.owner || !source.repo) {
        logger.error(`GitHub source #${idx} missing name, owner, or repo`);
        throw new Error(`GitHub source #${idx} missing name, owner, or repo`);
      }
    });
  }

  logger.info('Configuration validated successfully');
  return true;
}

/**
 * Apply defaults (mutates config in place).
 * @param {object} config
 */
export function applyConfigDefaults(config) {
  if (!config.processing) {
    config.processing = {};
  }
  if (config.processing.concurrency === undefined) {
    config.processing.concurrency = 6;
  }
  if (config.processing.max_article_recency_days === undefined) {
    config.processing.max_article_recency_days = 2;
  }
  if (!config.processing.github) {
    config.processing.github = {};
  }
  const gh = config.processing.github;
  if (gh.mcp_max_rounds === undefined) {
    gh.mcp_max_rounds = 20;
  }
  if (gh.mcp_timeout_ms === undefined) {
    gh.mcp_timeout_ms = 120000;
  }
  if (gh.mcp_max_tool_result_chars === undefined) {
    gh.mcp_max_tool_result_chars = 80000;
  }
}

/**
 * Load and validate configuration from YAML file
 * @param {string} configPath - Path to config file (default: ./config.yaml)
 * @returns {object} Validated configuration
 */
export function loadConfig(configPath = path.join(process.cwd(), 'config.yaml')) {
  logger.info(`Loading configuration from ${configPath}`);
  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const parsedConfig = yaml.parse(fileContents);
    
    validateConfig(parsedConfig);
    applyConfigDefaults(parsedConfig);
    
    logger.info('Configuration loaded successfully');
    return parsedConfig;
  } catch (error) {
    logger.error(`Failed to load configuration: ${error.message}`);
    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

// Export for testing and usage
export default { loadConfig, validateConfig, applyConfigDefaults };