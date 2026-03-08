import { join } from 'path';
import { git } from '../core/git';
import { env } from '../core/env';
import { config } from '../core/config';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function statusCommand(options: { json?: boolean }) {
  const root = git.root();
  const cfg = config.read(root);
  const currentBranch = git.currentBranch();
  const envPath = join(root, cfg.envFile);

  const currentEntry = config.getBranch(root, currentBranch);
  const currentEnvUrl = env.read(envPath, cfg.envKey);
  const branchCount = Object.keys(cfg.branches).length;
  const inSync = !!currentEntry && currentEnvUrl === currentEntry.url;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          branch: currentBranch,
          driver: cfg.driver,
          baseBranch: cfg.baseBranch,
          envFile: cfg.envFile,
          envKey: cfg.envKey,
          branchCount,
          database: currentEntry?.database ?? null,
          url: currentEntry?.url ?? null,
          inSync: currentEntry ? inSync : null,
        },
        null,
        2
      )
    );
    return;
  }

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

    console.log('');
    if (!inSync) {
      log.warn(
        `${cfg.envKey} in ${cfg.envFile} doesn't match branch database!`
      );
      log.dim(`  Expected: ${currentEntry.url}`);
      log.dim(`  Actual:   ${currentEnvUrl}`);
      log.dim(`  Fix: ${pc.white('branchdb switch')}`);
    } else {
      log.success('Environment is in sync.');
    }
  } else {
    log.warn(`No database registered for branch ${pc.cyan(currentBranch)}`);
    log.dim('  Using base branch database');
    log.dim(`  Create one: ${pc.white('branchdb clone')}`);
  }

  console.log('');
}
