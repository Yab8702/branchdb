import { join } from 'path';
import { git } from '../core/git';
import { env } from '../core/env';
import { config } from '../core/config';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function statusCommand() {
  const root = git.root();
  const cfg = config.read(root);
  const currentBranch = git.currentBranch();
  const envPath = join(root, cfg.envFile);

  const currentEntry = config.getBranch(root, currentBranch);
  const currentEnvUrl = env.read(envPath, cfg.envKey);
  const branchCount = Object.keys(cfg.branches).length;

  console.log('');
  log.info('branchdb status');
  console.log('');

  log.table([
    ['Branch:', pc.cyan(currentBranch)],
    ['Driver:', cfg.driver],
    ['Base branch:', cfg.baseBranch],
    ['Env file:', cfg.envFile],
    ['Branches:', `${branchCount} registered`],
  ]);

  console.log('');

  if (currentEntry) {
    log.table([
      ['Database:', pc.green(currentEntry.database)],
      ['URL:', currentEntry.url],
    ]);

    // Check if .env matches config
    if (currentEnvUrl !== currentEntry.url) {
      console.log('');
      log.warn(
        `${cfg.envKey} in ${cfg.envFile} doesn't match branch database!`
      );
      log.dim(`  Expected: ${currentEntry.url}`);
      log.dim(`  Actual:   ${currentEnvUrl}`);
      log.dim(`  Fix: ${pc.white('branchdb switch')}`);
    } else {
      console.log('');
      log.success('Environment is in sync.');
    }
  } else {
    log.warn(`No database registered for branch ${pc.cyan(currentBranch)}`);
    log.dim('  Using base branch database');
    log.dim(`  Create one: ${pc.white('branchdb clone')}`);
  }

  console.log('');
}
