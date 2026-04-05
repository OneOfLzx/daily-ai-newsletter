const { scanSkills, listSkillsForLLM, getSkill, loadSkill } = require('./index');
const path = require('path');
const fs = require('fs').promises;

describe('Agent Skills Infrastructure', () => {
  const TEST_SKILL_ID = 'test-skill';
  const TEST_SKILL_DIR = path.join(process.cwd(), '.agents', 'skills', TEST_SKILL_ID);
  
  beforeAll(async () => {
    // Create test skill directory
    await fs.mkdir(TEST_SKILL_DIR, { recursive: true });
    
    // Write test skill SKILL.md
    await fs.writeFile(
      path.join(TEST_SKILL_DIR, 'SKILL.md'),
      `---
name: ${TEST_SKILL_ID}
description: Test skill for validation
scope: test
priority: high
---
# Test Skill
This is a test skill used for validating the skills infrastructure.

## Features
- Skill discovery
- Metadata parsing
- Full content loading`
    );
  });
  
  afterAll(async () => {
    // Clean up test skill
    try {
      await fs.rm(TEST_SKILL_DIR, { recursive: true, force: true });
    } catch (err) {
      console.warn('Failed to clean up test skill:', err.message);
    }
  });
  
  test('scanSkills should discover all valid skills', async () => {
    const skills = await scanSkills();
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.length).toBeGreaterThan(0);
  });
  
  test('listSkillsForLLM should return properly formatted skill list', async () => {
    const skills = await listSkillsForLLM();
    expect(Array.isArray(skills)).toBe(true);
    
    const testSkill = skills.find(s => s.id === TEST_SKILL_ID);
    expect(testSkill).toBeDefined();
    expect(testSkill.description).toBe('Test skill for validation');
    expect(testSkill.scope).toBe('test');
  });
  
  test('getSkill should retrieve a specific skill by ID', async () => {
    const skill = await getSkill(TEST_SKILL_ID);
    expect(skill).toBeDefined();
    expect(skill.id).toBe(TEST_SKILL_ID);
    expect(skill.name).toBe(TEST_SKILL_ID);
    expect(skill.description).toBe('Test skill for validation');
    expect(skill.documentation).toContain('# Test Skill');
  });
  
  test('loadSkill should load all skill files including documentation', async () => {
    const skill = await loadSkill(TEST_SKILL_ID);
    expect(skill).toBeDefined();
    expect(skill.id).toBe(TEST_SKILL_ID);
    expect(skill.documentation).toContain('# Test Skill');
    expect(skill.files).toEqual({});
  });
  
  test('getSkill should return null for non-existent skill', async () => {
    const skill = await getSkill('non-existent-skill');
    expect(skill).toBeNull();
  });
});