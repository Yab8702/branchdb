import { join } from 'path';
import { rmSync } from 'fs';
import { git } from '../core/git';
import { env } from '../core/env';
import { config } from '../core/config';
import { getDriver } from '../core/driver-factory';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function uninitCommand(options: {
  force?: boolean;
  dropDatabases?: boolean;
}) {
  const root = git.root();

  if (!config.exists(root)) {
    log.error('branchdb is not initialized in this project.');
    process.exit(1);
  }

  const cfg = config.read(root);
  const branchDbs = Object.entries(cfg.branches).filter(
    ([b]) => b !== cfg.baseBranch
  );

  console.log('');
  log.warn('This will:');
  log.dim('  • Remove the post-checkout git hook');
  log.dim(`  • Restore ${cfg.envKey} to the base database URL`);
  log.dim('  • Delete .branchdb/ directory');
  if (options.dropDatabases && branchDbs.length > 0) {
    log.dim(`  • Drop ${branchDbs.length} branch database(s)`);
  }
  console.log('');

  if (!options.force) {
    log.warn('Nothing changed. Re-run with --force to confirm:');
    log.dim('  branchdb uninit --force');
    if (options.dropDatabases) {
      log.dim('  branchdb uninit --force --drop-databases');
    }
    process.exit(0);
  }

  // 1. Remove git hook
  git.removeHook(root);
  log.success('Removed git hook');

  // 2. Restore DATABASE_URL to base branch URL
  const envPath = join(root, cfg.envFile);
  env.write(envPath, cfg.envKey, cfg.baseUrl);
  log.success(`Restored ${cfg.envKey} to ${pc.white(cfg.baseBranch)} database`);

  // 3. Optionally drop all branch databases
  if (options.dropDatabases && branchDbs.length > 0) {
    const driver = getDriver(cfg, root);
    log.info(`Dropping ${branchDbs.length} branch database(s)...`);
    for (const [branch, entry] of branchDbs) {
      try {
        await driver.drop(entry.database);
        log.success(`  Dropped ${pc.dim(branch)} → ${entry.database}`);
      } catch (err: any) {
        log.warn(`  Failed to drop ${entry.database}: ${err.message}`);
      }
    }
    await driver.disconnect();
  }

  // 4. Delete .branchdb/ directory
  rmSync(config.dir(root), { recursive: true, force: true });
  log.success('Deleted .branchdb/');

  console.log('');
  log.success('branchdb removed from this project.');
  console.log('');
}
