import ghpages from 'gh-pages';
import { resolve, join } from 'path';
import { mkdir, cp, readdir, writeFile, access } from 'fs/promises';
import { fileURLToPath } from 'url';
import { argv } from 'process';
import Logger from '../utils/logger.js';

const logger = new Logger('deploy');

const DEFAULT_CONFIG = {
  branch: 'main',
  publicDir: resolve(process.cwd(), 'public'),
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
    const rootIndexContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Daily AI Newsletter</title>
  <meta http-equiv="refresh" content="0; url=./${latestDate}/">
</head>
<body>
  <p>Redirecting to latest newsletter...</p>
  <a href="./${latestDate}/">Click here if not redirected</a>
</body>
</html>`;
    await writeFile(join(opts.publicDir, 'index.html'), rootIndexContent);
    logger.info(`Root index.html created, redirecting to ${latestDate}`);
  }

  // If we have a repo, publish to GitHub Pages, otherwise just prepare public dir
  if (opts.repo) {
    logger.info('Publishing to GitHub Pages');
    return new Promise((resolve, reject) => {
      ghpages.publish(opts.publicDir, {
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