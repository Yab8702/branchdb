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

export async function resetCommand(options: {
  from?: string;
  force?: boolean;
  migrate?: boolean;
}) {
  const root = git.root();
  const cfg = config.read(root);
  const currentBranch = git.currentBranch();

  if (currentBranch === cfg.baseBranch && !options.force) {
    log.error(`Cannot reset the base branch (${cfg.baseBranch}).`);
    log.dim('  Use --force to override.');
    process.exit(1);
  }

  const sourceBranch = options.from || cfg.baseBranch;
  const sourceEntry = config.getBranch(root, sourceBranch);

  if (!sourceEntry) {
    log.error(
      `Source branch ${pc.cyan(sourceBranch)} has no registered database.`
    );
    process.exit(1);
  }

  const driver = getDriver(cfg, root);

  try {
    const existingEntry = config.getBranch(root, currentBranch);

    if (existingEntry) {
      log.info(`Dropping existing database for ${pc.cyan(currentBranch)}...`);
      try {
        await driver.drop(existingEntry.database);
      } catch {
        // Might already be gone
      }
      config.removeBranch(root, currentBranch);
    }

    const targetDb = generateDbName(cfg, currentBranch);
    const targetUrl = buildConnectionUrl(cfg.baseUrl, targetDb, cfg.driver);

    log.info(`Cloning fresh database from ${pc.cyan(sourceBranch)}...`);

    const start = Date.now();
    await driver.clone(sourceEntry.database, targetDb);
    const elapsed = Date.now() - start;

    const entry: BranchEntry = {
      database: targetDb,
      url: targetUrl,
      createdAt: new Date().toISOString(),
    };
    config.setBranch(root, currentBranch, entry);

    const envPath = join(root, cfg.envFile);
    env.write(envPath, cfg.envKey, targetUrl);

    console.log('');
    log.success(`Database reset in ${elapsed}ms`);
    log.dim(`  Branch:   ${pc.cyan(currentBranch)}`);
    log.dim(`  Database: ${pc.white(targetDb)}`);
    log.dim(`  Source:   ${sourceBranch}`);

    if (options.migrate) {
      runMigrate(root);
    }

    console.log('');
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
