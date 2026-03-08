import { join } from 'path';
import { git } from '../core/git';
import { env } from '../core/env';
import { config, BranchEntry } from '../core/config';
import { getDriver } from '../core/driver-factory';
import { detectOrm } from '../core/detector';
import { getAutoMigrateCommand } from './migrate';
import {
  generateDbName,
  buildConnectionUrl,
  execLive,
} from '../utils/helpers';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function switchCommand(options: {
  auto?: boolean;
  branch?: string;
}) {
  const root = git.root();
  const cfg = config.read(root);
  const branch = options.branch || git.currentBranch();
  const envPath = join(root, cfg.envFile);

  const branchEntry = config.getBranch(root, branch);

  if (branchEntry) {
    // Branch has a registered database — switch to it
    env.write(envPath, cfg.envKey, branchEntry.url);

    if (options.auto) {
      // Run auto-migrate if enabled
      if (cfg.autoMigrate) {
        autoMigrate(root, branch);
      }
      process.stderr.write(
        `[branchdb] → ${branch}\n`
      );
    } else {
      log.success(`Switched to database for branch ${pc.cyan(branch)}`);
      log.dim(`  ${cfg.envKey}=${branchEntry.url}`);
    }
    return;
  }

  // Branch doesn't have a database yet
  if (options.auto) {
    // Auto-provision: clone from base branch automatically
    if (branch === cfg.baseBranch) {
      // On base branch with no entry — shouldn't happen, but fall back safely
      const baseEntry = config.getBranch(root, cfg.baseBranch);
      if (baseEntry) {
        env.write(envPath, cfg.envKey, baseEntry.url);
      }
      return;
    }

    const sourceEntry = config.getBranch(root, cfg.baseBranch);
    if (!sourceEntry) {
      // Can't auto-provision without a base — fall back silently
      return;
    }

    try {
      const targetDb = generateDbName(cfg, branch);
      const targetUrl = buildConnectionUrl(cfg.baseUrl, targetDb, cfg.driver);

      const driver = getDriver(cfg, root);
      try {
        await driver.clone(sourceEntry.database, targetDb);
      } finally {
        await driver.disconnect();
      }

      const entry: BranchEntry = {
        database: targetDb,
        url: targetUrl,
        createdAt: new Date().toISOString(),
      };
      config.setBranch(root, branch, entry);
      env.write(envPath, cfg.envKey, targetUrl);

      // Auto-migrate if enabled
      let migrateNote = '';
      if (cfg.autoMigrate) {
        migrateNote = autoMigrate(root, branch)
          ? ' + migrated'
          : '';
      }

      process.stderr.write(
        `[branchdb] → ${branch} (created${migrateNote})\n`
      );
    } catch {
      // Auto-provision failed — fall back to base silently
      env.write(envPath, cfg.envKey, sourceEntry.url);
    }
    return;
  }

  // Interactive mode — inform user and fall back
  log.warn(`No database registered for branch ${pc.cyan(branch)}`);
  log.dim(`  Using base branch database (${cfg.baseBranch})`);
  log.dim('');
  log.dim(
    `  To create a branch database: ${pc.white('branchdb clone')}`
  );

  const baseEntry = config.getBranch(root, cfg.baseBranch);
  if (baseEntry) {
    env.write(envPath, cfg.envKey, baseEntry.url);
  }
}

/**
 * Run the non-interactive ORM migration command.
 * Returns true if migrations ran, false if skipped/failed.
 */
function autoMigrate(root: string, branch: string): boolean {
  try {
    const detection = detectOrm(root);
    const cmd = getAutoMigrateCommand(detection.orm);
    if (!cmd) return false;

    execLive(cmd, { cwd: root });
    return true;
  } catch {
    process.stderr.write(
      `[branchdb] migration failed on ${branch} — run: branchdb migrate\n`
    );
    return false;
  }
}
