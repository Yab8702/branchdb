import { git } from '../core/git';
import { config } from '../core/config';
import { getDriver } from '../core/driver-factory';
import { log } from '../utils/logger';
import pc from 'picocolors';

/**
 * Snapshot management: save and restore named snapshots of branch databases.
 *
 * Snapshots are stored as entries in config with a `snapshot:` prefix.
 * The actual data is cloned via the driver (PG TEMPLATE or SQLite file copy).
 */

export async function snapshotCommand(options: {
  name?: string;
  list?: boolean;
  restore?: string;
  delete?: string;
}) {
  const root = git.root();
  const cfg = config.read(root);
  const branch = git.currentBranch();

  // List all snapshots
  if (options.list) {
    const snapshots = Object.entries(cfg.branches).filter(([k]) =>
      k.startsWith('snapshot:')
    );

    if (snapshots.length === 0) {
      log.info('No snapshots saved.');
      log.dim('  Save one: branchdb snapshot --name before-migration');
      return;
    }

    console.log('');
    log.info(`${snapshots.length} snapshot(s):`);
    console.log('');

    for (const [key, entry] of snapshots) {
      const name = key.replace('snapshot:', '');
      const age = formatAge(entry.createdAt);
      console.log(`  ${pc.yellow(name)}`);
      console.log(`    ${pc.dim('db:')} ${entry.database}  ${pc.dim(age)}`);
    }
    console.log('');
    return;
  }

  // Delete a snapshot
  if (options.delete) {
    const key = `snapshot:${options.delete}`;
    const entry = cfg.branches[key];
    if (!entry) {
      log.error(`Snapshot ${pc.yellow(options.delete)} not found.`);
      process.exit(1);
    }

    const driver = getDriver(cfg, root);
    try {
      try {
        await driver.drop(entry.database);
      } catch {
        // May already be gone
      }
      config.removeBranch(root, key);
      log.success(`Deleted snapshot ${pc.yellow(options.delete)}`);
    } finally {
      await driver.disconnect();
    }
    return;
  }

  // Restore a snapshot
  if (options.restore) {
    const key = `snapshot:${options.restore}`;
    const snapshotEntry = cfg.branches[key];
    if (!snapshotEntry) {
      log.error(`Snapshot ${pc.yellow(options.restore)} not found.`);
      log.dim('  List snapshots: branchdb snapshot --list');
      process.exit(1);
    }

    const currentEntry = config.getBranch(root, branch);
    if (!currentEntry) {
      log.error(`No database for branch ${pc.cyan(branch)}. Run: branchdb clone`);
      process.exit(1);
    }

    const driver = getDriver(cfg, root);
    try {
      log.info(`Restoring ${pc.yellow(options.restore)} → ${pc.cyan(branch)}...`);

      // Drop current branch DB
      try {
        await driver.drop(currentEntry.database);
      } catch {
        // May already be gone
      }

      // Clone snapshot → branch DB
      await driver.clone(snapshotEntry.database, currentEntry.database);

      log.success(`Restored snapshot ${pc.yellow(options.restore)}`);
      log.dim(`  Branch: ${branch}`);
      log.dim(`  Database: ${currentEntry.database}`);
    } finally {
      await driver.disconnect();
    }
    return;
  }

  // Save a snapshot (default action)
  const currentEntry = config.getBranch(root, branch);
  if (!currentEntry) {
    log.error(`No database for branch ${pc.cyan(branch)}. Run: branchdb clone`);
    process.exit(1);
  }

  const name = options.name || `${branch.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;
  const key = `snapshot:${name}`;

  if (cfg.branches[key]) {
    log.error(`Snapshot ${pc.yellow(name)} already exists.`);
    log.dim('  Delete it first: branchdb snapshot --delete ' + name);
    process.exit(1);
  }

  const snapshotDb = cfg.driver === 'postgres'
    ? `${currentEntry.database}_snap_${name.replace(/[^a-z0-9]/gi, '_').slice(0, 20)}`
    : `.branchdb/snapshots/snap_${name.replace(/[^a-z0-9]/gi, '_')}.db`;

  const driver = getDriver(cfg, root);
  try {
    log.info(`Saving snapshot ${pc.yellow(name)}...`);

    const start = Date.now();
    await driver.clone(currentEntry.database, snapshotDb);
    const elapsed = Date.now() - start;

    config.setBranch(root, key, {
      database: snapshotDb,
      url: '', // Snapshots aren't used as connection URLs
      createdAt: new Date().toISOString(),
    });

    console.log('');
    log.success(`Snapshot saved in ${elapsed}ms`);
    log.dim(`  Name:     ${pc.yellow(name)}`);
    log.dim(`  Source:   ${currentEntry.database}`);
    log.dim(`  Restore:  branchdb snapshot --restore ${name}`);
    console.log('');
  } finally {
    await driver.disconnect();
  }
}

function formatAge(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
