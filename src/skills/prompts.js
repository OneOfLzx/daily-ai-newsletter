import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Logger from '../utils/logger.js';

const logger = new Logger('skills-prompts');

const SKILL_KEYS = ['web', 'rss', 'github', 'translation'];

/**
 * @param {string} skillId - Directory name under .agents/skills
 * @returns {string} Absolute path to SKILL.md
 */
export function skillMdPath(skillId) {
  return path.join(process.cwd(), '.agents', 'skills', skillId, 'SKILL.md');
}

/**
 * Read SKILL.md body (excluding YAML frontmatter) for use as LLM system prompt.
 * @param {string} skillId
 * @returns {string}
 */
export function readSystemPromptFromSkillSync(skillId) {
  const filePath = skillMdPath(skillId);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Skill SKILL.md not found for id "${skillId}" at ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const { content } = matter(raw);
  const body = (content || '').trim();
  if (!body) {
    logger.warn(`Skill "${skillId}" has empty documentation body`);
  }
  return body;
}

/**
 * @param {object} config - Full newsletter config (must include config.skills)
 * @returns {{ web: string, rss: string, github: string, translation: string }}
 */
export function loadSkillSystemPrompts(config) {
  const skills = config.skills;
  if (!skills || typeof skills !== 'object') {
    throw new Error('config.skills is required');
  }
  const out = {};
  for (const key of SKILL_KEYS) {
    const id = skills[key];
    if (!id || typeof id !== 'string') {
      throw new Error(`config.skills.${key} must be a non-empty string (skill directory name)`);
    }
    out[key] = readSystemPromptFromSkillSync(id.trim());
  }
  return out;
}

/** User prompts for summarization / translation (fixed wording). */
export const USER_PROMPTS = {
  summarizeArticle: 'Please summarize the following article content in English according to your instructions. Do not copy existing summaries from the source; produce a fresh summary.\n\n---\n\n',
  summarizeGitHubProject:
    'Summarize this GitHub repository for a technical newsletter. You will receive function tools backed by GitMCP for this repo. Use tools to read documentation and code; do not state technical facts you have not retrieved via tools. When done, answer in English using the structure in your system instructions.\n\nRepository URL:\n',
  summarizeGitHubMissingRepo:
    'This trending entry has no valid https://github.com/<owner>/<repo> URL. Reply in one or two English sentences that you cannot access a repository without a link.',
  translateToZh: 'Translate the following English text into Chinese according to your instructions.\n\n---\n\n',
};
