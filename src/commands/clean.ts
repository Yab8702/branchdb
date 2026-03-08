import { git } from '../core/git';
import { config } from '../core/config';
import { getDriver } from '../core/driver-factory';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function cleanCommand(options: {
  branch?: string;
  all?: boolean;
  stale?: boolean;
  force?: boolean;
}) {
  const root = git.root();
  const cfg = config.read(root);
  const currentBranch = git.currentBranch();

  const driver = getDriver(cfg, root);

  try {
    // --stale: drop databases for branches that no longer exist locally
    if (options.stale) {
      const gitBranches = git.branches();
      const stale = Object.entries(cfg.branches).filter(
        ([b]) =>
          b !== cfg.baseBranch &&
          !b.startsWith('snapshot:') &&
          !gitBranches.includes(b)
      );

      if (stale.length === 0) {
        log.success('No stale branch databases found.');
        return;
      }

      log.info(`Found ${stale.length} stale branch database(s):`);
      console.log('');
      for (const [branch, entry] of stale) {
        log.dim(`  ${pc.cyan(branch)} → ${entry.database}`);
      }
      console.log('');

      if (!options.force) {
        log.warn('Run with --force to drop these databases.');
        return;
      }

      let cleaned = 0;
      for (const [branch, entry] of stale) {
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
      log.success(`Cleaned ${cleaned} stale branch database(s).`);
      return;
    }

    if (options.all) {
      // Clean all non-base branch databases (excluding snapshots)
      const branches = Object.entries(cfg.branches).filter(
        ([b]) => b !== cfg.baseBranch && !b.startsWith('snapshot:')
      );

      if (branches.length === 0) {
        log.info('No branch databases to clean.');
        return;
      }

      log.info(`Cleaning ${branches.length} branch database(s)...`);
      console.log('');

      let cleaned = 0;
      let skipped = 0;
      for (const [branch, entry] of branches) {
        // Check protection
        if (config.isProtected(root, branch) && !options.force) {
          log.warn(
            `Skipping protected branch ${pc.cyan(branch)}. Use --force to override.`
          );
          skipped++;
          continue;
        }

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
      log.success(
        `Cleaned ${cleaned} branch database(s).` +
          (skipped > 0 ? ` Skipped ${skipped} protected.` : '')
      );
      return;
    }

    // Clean specific branch (or current)
    const targetBranch = options.branch || currentBranch;

    if (targetBranch === cfg.baseBranch && !options.force) {
      log.error(`Cannot clean the base branch (${cfg.baseBranch}).`);
      log.dim('  The base branch database is your source of truth.');
      log.dim('  Use --force to override.');
      process.exit(1);
    }

    // Check protection
    if (config.isProtected(root, targetBranch) && !options.force) {
      log.error(
        `Branch ${pc.cyan(targetBranch)} is protected.`
      );
      log.dim('  Use --force to override, or remove protection:');
      log.dim(`  branchdb protect ${targetBranch} --remove`);
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
