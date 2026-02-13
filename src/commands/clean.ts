import { git } from '../core/git';
import { config } from '../core/config';
import { log } from '../utils/logger';
import { PostgresDriver } from '../drivers/postgres';
import { SqliteDriver } from '../drivers/sqlite';
import type { DbDriver } from '../drivers/types';
import pc from 'picocolors';

function getDriver(cfg: { driver: string; baseUrl: string }, root: string): DbDriver {
  if (cfg.driver === 'postgres') {
    return new PostgresDriver(cfg.baseUrl);
  }
  return new SqliteDriver(cfg.baseUrl, root);
}

export async function cleanCommand(options: {
  branch?: string;
  all?: boolean;
}) {
  const root = git.root();
  const cfg = config.read(root);
  const currentBranch = git.currentBranch();

  const driver = getDriver(cfg, root);

  try {
    if (options.all) {
      // Clean all non-base branch databases
      const branches = Object.entries(cfg.branches).filter(
        ([b]) => b !== cfg.baseBranch
      );

      if (branches.length === 0) {
        log.info('No branch databases to clean.');
        return;
      }

      log.info(`Cleaning ${branches.length} branch database(s)...`);
      console.log('');

      let cleaned = 0;
      for (const [branch, entry] of branches) {
        try {
          await driver.drop(entry.database);
          config.removeBranch(root, branch);
          log.success(`Dropped ${pc.dim(branch)} → ${entry.database}`);
          cleaned++;
        } catch (err: any) {
          log.error(`Failed to drop ${entry.database}: ${err.message}`);
        }
      }

      console.log('');
      log.success(`Cleaned ${cleaned} branch database(s).`);
      return;
    }

    // Clean specific branch (or current)
    const targetBranch = options.branch || currentBranch;

    if (targetBranch === cfg.baseBranch) {
      log.error(`Cannot clean the base branch (${cfg.baseBranch}).`);
      log.dim('  The base branch database is your source of truth.');
      process.exit(1);
    }

    const entry = config.getBranch(root, targetBranch);
    if (!entry) {
      log.warn(
        `No database registered for branch ${pc.cyan(targetBranch)}.`
      );
      return;
    }

    log.info(`Dropping database for branch ${pc.cyan(targetBranch)}...`);

    await driver.drop(entry.database);
    config.removeBranch(root, targetBranch);

    console.log('');
    log.success(`Dropped database: ${entry.database}`);
    console.log('');
  } finally {
    await driver.disconnect();
  }
}
