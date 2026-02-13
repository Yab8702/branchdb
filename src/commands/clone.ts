import { join } from 'path';
import { git } from '../core/git';
import { env } from '../core/env';
import { config, BranchEntry } from '../core/config';
import {
  sanitizeBranchName,
  buildConnectionUrl,
  parseConnectionUrl,
} from '../utils/helpers';
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

export async function cloneCommand(options: {
  from?: string;
  to?: string;
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
      `  To recreate: branchdb clean ${targetBranch} && branchdb clone`
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

  // Generate target database name
  const parsed = parseConnectionUrl(cfg.baseUrl);
  const sanitized = sanitizeBranchName(targetBranch);

  let targetDb: string;
  if (cfg.driver === 'postgres') {
    targetDb = `${parsed.database}_branchdb_${sanitized}`;
  } else {
    targetDb = `.branchdb/snapshots/${sanitized}.db`;
  }

  const targetUrl = buildConnectionUrl(cfg.baseUrl, targetDb, cfg.driver);

  // Clone the database
  log.info(`Cloning database for branch ${pc.cyan(targetBranch)}...`);
  log.dim(`  From: ${sourceEntry.database}`);
  log.dim(`  To:   ${targetDb}`);

  const driver = getDriver(cfg, root);

  try {
    const start = Date.now();
    await driver.clone(sourceEntry.database, targetDb);
    const elapsed = Date.now() - start;

    // Register in config
    const entry: BranchEntry = {
      database: targetDb,
      url: targetUrl,
      createdAt: new Date().toISOString(),
    };
    config.setBranch(root, targetBranch, entry);

    // Update .env to point to new database
    const envPath = join(root, cfg.envFile);
    env.write(envPath, cfg.envKey, targetUrl);

    console.log('');
    log.success(`Database cloned in ${elapsed}ms`);
    log.dim(`  Branch:   ${pc.cyan(targetBranch)}`);
    log.dim(`  Database: ${pc.white(targetDb)}`);
    log.dim(`  ${cfg.envKey} updated in ${cfg.envFile}`);
    console.log('');
  } catch (err: any) {
    log.error(`Failed to clone database: ${err.message}`);
    process.exit(1);
  } finally {
    await driver.disconnect();
  }
}
