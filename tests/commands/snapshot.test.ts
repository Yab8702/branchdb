import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { config } from '../../src/core/config';
import { SqliteDriver } from '../../src/drivers/sqlite';

const TEST_DIR = join(tmpdir(), 'branchdb-test-snapshot-' + Date.now());

function gitExec(cmd: string) {
  return execSync(cmd, { cwd: TEST_DIR, encoding: 'utf-8', stdio: 'pipe' });
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  gitExec('git init');
  gitExec('git config user.email "test@test.com"');
  gitExec('git config user.name "Test"');
  writeFileSync(join(TEST_DIR, '.env'), 'DATABASE_URL="file:./dev.db"\n');
  writeFileSync(join(TEST_DIR, 'dev.db'), 'original-data');
  gitExec('git add -A');
  gitExec('git commit -m "init"');
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  config._clearCache();
});

describe('snapshot workflow', () => {
  it('save and restore a snapshot', async () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'master',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);

    // Clone for feature branch
    await driver.clone('./dev.db', '.branchdb/snapshots/feature_x.db');
    config.setBranch(TEST_DIR, 'feature/x', {
      database: '.branchdb/snapshots/feature_x.db',
      url: 'file:.branchdb/snapshots/feature_x.db',
      createdAt: new Date().toISOString(),
    });

    // Take a snapshot of feature/x
    const snapshotDb = '.branchdb/snapshots/snap_before_migration.db';
    await driver.clone('.branchdb/snapshots/feature_x.db', snapshotDb);
    config.setBranch(TEST_DIR, 'snapshot:before-migration', {
      database: snapshotDb,
      url: '',
      createdAt: new Date().toISOString(),
    });

    expect(existsSync(join(TEST_DIR, snapshotDb))).toBe(true);

    // Modify the branch DB (simulate destructive migration)
    writeFileSync(
      join(TEST_DIR, '.branchdb', 'snapshots', 'feature_x.db'),
      'modified-after-migration'
    );

    // Verify it's modified
    expect(
      readFileSync(join(TEST_DIR, '.branchdb', 'snapshots', 'feature_x.db'), 'utf-8')
    ).toBe('modified-after-migration');

    // Restore the snapshot
    await driver.drop('.branchdb/snapshots/feature_x.db');
    await driver.clone(snapshotDb, '.branchdb/snapshots/feature_x.db');

    // Verify restored
    expect(
      readFileSync(join(TEST_DIR, '.branchdb', 'snapshots', 'feature_x.db'), 'utf-8')
    ).toBe('original-data');
  });

  it('lists snapshots via config', () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'master',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    config.setBranch(TEST_DIR, 'snapshot:snap1', {
      database: '.branchdb/snapshots/snap_snap1.db',
      url: '',
      createdAt: new Date().toISOString(),
    });

    config.setBranch(TEST_DIR, 'snapshot:snap2', {
      database: '.branchdb/snapshots/snap_snap2.db',
      url: '',
      createdAt: new Date().toISOString(),
    });

    const cfg = config.read(TEST_DIR);
    const snapshots = Object.keys(cfg.branches).filter((k) => k.startsWith('snapshot:'));
    expect(snapshots).toHaveLength(2);
    expect(snapshots).toContain('snapshot:snap1');
    expect(snapshots).toContain('snapshot:snap2');
  });

  it('deletes a snapshot', async () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'master',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    const snapshotDb = '.branchdb/snapshots/snap_to_delete.db';

    await driver.clone('./dev.db', snapshotDb);
    config.setBranch(TEST_DIR, 'snapshot:to-delete', {
      database: snapshotDb,
      url: '',
      createdAt: new Date().toISOString(),
    });

    expect(existsSync(join(TEST_DIR, snapshotDb))).toBe(true);

    // Delete
    await driver.drop(snapshotDb);
    config.removeBranch(TEST_DIR, 'snapshot:to-delete');

    expect(existsSync(join(TEST_DIR, snapshotDb))).toBe(false);
    expect(config.getBranch(TEST_DIR, 'snapshot:to-delete')).toBeNull();
  });
});
