import ghpages from 'gh-pages';
import { resolve, join } from 'path';
import { mkdir, cp, rm, readdir, writeFile, access } from 'fs/promises';
import { rootLandingRedirectHtml } from '../utils/root-index.js';
import { fileURLToPath } from 'url';
import { argv } from 'process';
import Logger from '../utils/logger.js';

const logger = new Logger('deploy');

const DEFAULT_CONFIG = {
  branch: 'main',
  projectRoot: resolve(process.cwd()),
  publicDir: resolve(process.cwd(), 'public'),
  /** Ephemeral folder: root index + `public/` copy for gh-pages (site root must include both). */
  pagesStagingDir: resolve(process.cwd(), '.ghpages-build'),
  dataDir: resolve(process.cwd(), 'data'),
  preserveHistory: true,
};

async function dirExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function deploy(config = {}) {
  logger.info('Starting deployment to GitHub Pages');
  const opts = {
    repo: process.env.GITHUB_PAGES_REPO,
    ...DEFAULT_CONFIG,
    ...config
  };

  logger.debug('Creating public directory');
  await mkdir(opts.publicDir, { recursive: true });


  // Create root index.html redirecting to latest date
  logger.info('Creating root index.html');
  let dateDirs = [];
  if (await dirExists(opts.publicDir)) {
    const entries = await readdir(opts.publicDir, { withFileTypes: true });
    dateDirs = entries
      .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
      .map(entry => entry.name)
      .sort()
      .reverse();
  }
  
  const latestDate = dateDirs[0];
  if (latestDate) {
    const rootIndexContent = rootLandingRedirectHtml(latestDate);
    await writeFile(join(opts.projectRoot, 'index.html'), rootIndexContent);
    logger.info(`Root index.html created at project root, redirecting to public/${latestDate}/`);
  }

  // If we have a repo, publish to GitHub Pages, otherwise just prepare public dir
  if (opts.repo) {
    logger.info('Publishing to GitHub Pages');
    if (!latestDate) {
      logger.warn('No dated editions under public/; skipping publish (nothing to link from root index)');
      return Promise.resolve();
    }
    await rm(opts.pagesStagingDir, { recursive: true, force: true });
    await mkdir(opts.pagesStagingDir, { recursive: true });
    await writeFile(join(opts.pagesStagingDir, 'index.html'), rootLandingRedirectHtml(latestDate));
    await cp(opts.publicDir, join(opts.pagesStagingDir, 'public'), { recursive: true });

    return new Promise((resolve, reject) => {
      ghpages.publish(opts.pagesStagingDir, {
        repo: opts.repo,
        branch: opts.branch,
        message: opts.preserveHistory
          ? `Deploy daily archive: ${new Date().toISOString()}`
          : 'Deploy site',
      }, (err) => {
        if (err) {
          logger.error(`Deployment failed: ${err.message}`);
          reject(err);
        } else {
          logger.info('✅ Deployment successful!');
          resolve();
        }
      });
    });
  } else {
    logger.info('No GITHUB_PAGES_REPO set, skipping GitHub Pages publish');
    return Promise.resolve();
  }
}

const __filename = fileURLToPath(import.meta.url);
const invokedAsMain = argv[1] && resolve(argv[1]) === resolve(__filename);
if (invokedAsMain) {
  try {
    await deploy();
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}

export default deploy;