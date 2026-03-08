import { join } from 'path';
import { git } from '../core/git';
import { env } from '../core/env';
import { config, BranchEntry } from '../core/config';
import { generateDbName, buildConnectionUrl, execLive } from '../utils/helpers';
import { getDriver } from '../core/driver-factory';
import { detectOrm } from '../core/detector';
import { getAutoMigrateCommand } from './migrate';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function cloneCommand(options: {
  from?: string;
  to?: string;
  migrate?: boolean;
}) {
  const root = git.root();
  const cfg = config.read(root);
  const currentBranch = git.currentBranch();

  const sourceBranch = options.from || cfg.baseBranch;
  const targetBranch = options.to || currentBranch;

  // Don't clone onto base branch
  if (targetBranch === cfg.baseBranch && !options.to) {
    log.error(`Cannot clone to base branch (${cfg.baseBranch}).`);
    log.dim(
      '  Switch to a feature branch first, or use: branchdb clone --to <branch>'
    );
    process.exit(1);
  }

  // Check if target already has a database
  const existing = config.getBranch(root, targetBranch);
  if (existing) {
    log.warn(`Branch ${pc.cyan(targetBranch)} already has a database.`);
    log.dim(`  Database: ${existing.database}`);
    log.dim(
      `  To recreate: branchdb reset`
    );
    return;
  }

  // Get source database
  const sourceEntry = config.getBranch(root, sourceBranch);
  if (!sourceEntry) {
    log.error(
      `Source branch ${pc.cyan(sourceBranch)} has no registered database.`
    );
    process.exit(1);
  }

  const targetDb = generateDbName(cfg, targetBranch);
  const targetUrl = buildConnectionUrl(cfg.baseUrl, targetDb, cfg.driver);

  log.info(`Cloning database for branch ${pc.cyan(targetBranch)}...`);
  log.dim(`  From: ${sourceEntry.database}`);
  log.dim(`  To:   ${targetDb}`);

  const driver = getDriver(cfg, root);

  try {
    const start = Date.now();
    await driver.clone(sourceEntry.database, targetDb);
    const elapsed = Date.now() - start;

    const entry: BranchEntry = {
      database: targetDb,
      url: targetUrl,
      createdAt: new Date().toISOString(),
    };
    config.setBranch(root, targetBranch, entry);

    const envPath = join(root, cfg.envFile);
    env.write(envPath, cfg.envKey, targetUrl);

    console.log('');
    log.success(`Database cloned in ${elapsed}ms`);
    log.dim(`  Branch:   ${pc.cyan(targetBranch)}`);
    log.dim(`  Database: ${pc.white(targetDb)}`);
    log.dim(`  ${cfg.envKey} updated in ${cfg.envFile}`);

    if (options.migrate) {
      runMigrate(root);
    }

    console.log('');
  } catch (err: any) {
    log.error(`Failed to clone database: ${err.message}`);
    process.exit(1);
  } finally {
    await driver.disconnect();
  }
}

function runMigrate(root: string): void {
  const detection = detectOrm(root);
  const cmd = getAutoMigrateCommand(detection.orm);
  if (!cmd) {
    log.dim('  No ORM detected — skipping migrations.');
    return;
  }

  console.log('');
  log.info(`Running migrations: ${pc.white(cmd)}`);

  try {
    execLive(cmd, { cwd: root });
    log.success('Migrations applied.');
  } catch {
    log.error('Migration failed. Run manually: branchdb migrate');
  }
}
