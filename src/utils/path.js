import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Ensure a directory exists, create it recursively if not
 * @param {string} dirPath - Path to directory
 */
export async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true, mode: 0o755 });
  }
}