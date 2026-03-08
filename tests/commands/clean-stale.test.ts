import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { config } from '../../src/core/config';
import { SqliteDriver } from '../../src/drivers/sqlite';

const TEST_DIR = join(tmpdir(), 'branchdb-test-stale-' + Date.now());

function gitExec(cmd: string) {
  return execSync(cmd, { cwd: TEST_DIR, encoding: 'utf-8', stdio: 'pipe' });
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  gitExec('git init');
  gitExec('git config user.email "test@test.com"');
  gitExec('git config user.name "Test"');
  writeFileSync(join(TEST_DIR, '.env'), 'DATABASE_URL="file:./dev.db"\n');
  writeFileSync(join(TEST_DIR, 'dev.db'), 'sqlite-data');
  gitExec('git add -A');
  gitExec('git commit -m "init"');
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  config._clearCache();
});

describe('clean --stale logic', () => {
  it('identifies stale branches (config has branch, git does not)', async () => {
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

    // Clone DBs for two branches
    await driver.clone('./dev.db', '.branchdb/snapshots/feature_a.db');
    config.setBranch(TEST_DIR, 'feature/a', {
      database: '.branchdb/snapshots/feature_a.db',
      url: 'file:.branchdb/snapshots/feature_a.db',
      createdAt: new Date().toISOString(),
    });

    await driver.clone('./dev.db', '.branchdb/snapshots/feature_b.db');
    config.setBranch(TEST_DIR, 'feature/b', {
      database: '.branchdb/snapshots/feature_b.db',
      url: 'file:.branchdb/snapshots/feature_b.db',
      createdAt: new Date().toISOString(),
    });

    // Create only one of those branches in git
    gitExec('git checkout -b feature/a');
    gitExec('git checkout master');

    // feature/b doesn't exist in git — it's stale
    const gitBranches = gitExec('git branch --list')
      .split('\n')
      .map((b) => b.replace(/^\*?\s+/, '').trim())
      .filter(Boolean);

    const cfg = config.read(TEST_DIR);
    const stale = Object.entries(cfg.branches).filter(
      ([b]) => b !== cfg.baseBranch && !gitBranches.includes(b)
    );

    expect(stale.length).toBe(1);
    expect(stale[0][0]).toBe('feature/b');
  });

  it('reports no stale when all branches exist', async () => {
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

    // Create branch in both git and config
    gitExec('git checkout -b feature/a');
    gitExec('git checkout master');

    await driver.clone('./dev.db', '.branchdb/snapshots/feature_a.db');
    config.setBranch(TEST_DIR, 'feature/a', {
      database: '.branchdb/snapshots/feature_a.db',
      url: 'file:.branchdb/snapshots/feature_a.db',
      createdAt: new Date().toISOString(),
    });

    const gitBranches = gitExec('git branch --list')
      .split('\n')
      .map((b) => b.replace(/^\*?\s+/, '').trim())
      .filter(Boolean);

    const cfg = config.read(TEST_DIR);
    const stale = Object.entries(cfg.branches).filter(
      ([b]) => b !== cfg.baseBranch && !gitBranches.includes(b)
    );

    expect(stale.length).toBe(0);
  });

  it('never marks base branch as stale', () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'master',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    // Even if somehow baseBranch was deleted from git, it should never be stale
    const cfg = config.read(TEST_DIR);
    const stale = Object.entries(cfg.branches).filter(
      ([b]) => b !== cfg.baseBranch && !['other'].includes(b)
    );

    expect(stale.length).toBe(0);
  });

  it('cleans stale branch databases', async () => {
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

    // Create DB for a branch that doesn't exist in git
    await driver.clone('./dev.db', '.branchdb/snapshots/deleted_branch.db');
    config.setBranch(TEST_DIR, 'deleted-branch', {
      database: '.branchdb/snapshots/deleted_branch.db',
      url: 'file:.branchdb/snapshots/deleted_branch.db',
      createdAt: new Date().toISOString(),
    });

    const dbPath = join(TEST_DIR, '.branchdb', 'snapshots', 'deleted_branch.db');
    expect(existsSync(dbPath)).toBe(true);

    // Simulate clean --stale --force
    await driver.drop('.branchdb/snapshots/deleted_branch.db');
    config.removeBranch(TEST_DIR, 'deleted-branch');

    expect(existsSync(dbPath)).toBe(false);
    expect(config.getBranch(TEST_DIR, 'deleted-branch')).toBeNull();
  });
});
