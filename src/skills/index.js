import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import Logger from '../utils/logger.js';

const logger = new Logger('skills');

const SKILLS_BASE_DIR = path.join(process.cwd(), '.agents', 'skills');

/**
 * Scan all skill directories and parse their metadata
 * @returns {Array<{id: string, name: string, description: string, scope: string, priority: string, path: string, documentation: string}>}
 */
async function scanSkills() {
  logger.info('Scanning skills directory...');
  const skills = [];
  
  try {
    const skillEntries = await fs.readdir(SKILLS_BASE_DIR, { withFileTypes: true });
    
    for (const entry of skillEntries) {
      if (entry.isDirectory()) {
        const skillDir = path.join(SKILLS_BASE_DIR, entry.name);
        const skillMdPath = path.join(skillDir, 'SKILL.md');
        
        try {
          logger.debug(`Reading skill: ${entry.name}`);
          const mdContent = await fs.readFile(skillMdPath, 'utf8');
          const { data: metadata, content: documentation } = matter(mdContent);
          
          skills.push({
            id: metadata.name || entry.name,
            name: metadata.name || entry.name,
            description: metadata.description || '',
            scope: metadata.scope || 'user',
            priority: metadata.priority || 'medium',
            path: skillDir,
            documentation: documentation.trim()
          });
        } catch (err) {
          logger.warn(`Skipping invalid skill directory ${entry.name}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    logger.error(`Failed to scan skills directory: ${err.message}`);
  }
  
  logger.info(`Found ${skills.length} skills`);
  return skills;
}

/**
 * Get a single skill by ID
 * @param {string} skillId - ID of the skill to retrieve
 * @returns {Promise<object|null>}
 */
async function getSkill(skillId) {
  logger.debug(`Getting skill: ${skillId}`);
  const skills = await scanSkills();
  const skill = skills.find(skill => skill.id === skillId) || null;
  if (skill) {
    logger.debug(`Found skill: ${skillId}`);
  } else {
    logger.warn(`Skill not found: ${skillId}`);
  }
  return skill;
}

/**
 * Load full skill content including all files
 * @param {string} skillId - ID of the skill to load
 * @returns {Promise<object|null>}
 */
async function loadSkill(skillId) {
  logger.info(`Loading skill: ${skillId}`);
  const skill = await getSkill(skillId);
  if (!skill) return null;
  
  const skillFiles = {};
  
  try {
    const files = await fs.readdir(skill.path);
    
    for (const file of files) {
      if (file !== 'SKILL.md') {
        const filePath = path.join(skill.path, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          logger.debug(`Loading skill file: ${file}`);
          skillFiles[file] = await fs.readFile(filePath, 'utf8');
        }
      }
    }
  } catch (err) {
    logger.warn(`Failed to load files for skill ${skillId}: ${err.message}`);
  }
  
  logger.info(`Loaded skill: ${skillId}`);
  return {
    ...skill,
    files: skillFiles
  };
}

/**
 * List skills formatted for LLM disclosure
 * @returns {Promise<Array<{id: string, name: string, description: string, scope: string, priority: string}>>}
 */
async function listSkillsForLLM() {
  logger.debug('Listing skills for LLM');
  const skills = await scanSkills();
  return skills.map(({ id, name, description, scope, priority }) => ({
    id,
    name,
    description,
    scope,
    priority
  }));
}

export {
  scanSkills,
  getSkill,
  loadSkill,
  listSkillsForLLM
};