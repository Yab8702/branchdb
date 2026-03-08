import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { SqliteDriver } from '../../src/drivers/sqlite';
import { config } from '../../src/core/config';
import { env } from '../../src/core/env';

const TEST_DIR = join(tmpdir(), 'branchdb-integ-sqlite-' + Date.now());

function gitExec(cmd: string) {
  return execSync(cmd, { cwd: TEST_DIR, encoding: 'utf-8', stdio: 'pipe' });
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  // Initialize git repo
  gitExec('git init');
  gitExec('git config user.email "test@test.com"');
  gitExec('git config user.name "Test"');

  // Create initial files
  writeFileSync(join(TEST_DIR, '.env'), 'DATABASE_URL="file:./dev.db"\n');
  writeFileSync(join(TEST_DIR, 'dev.db'), 'sqlite-data-here');
  gitExec('git add -A');
  gitExec('git commit -m "init"');
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('SQLite Driver', () => {
  it('clones a database file', async () => {
    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    await driver.clone('./dev.db', '.branchdb/snapshots/feature_auth.db');
    const clonePath = join(
      TEST_DIR,
      '.branchdb',
      'snapshots',
      'feature_auth.db'
    );
    expect(existsSync(clonePath)).toBe(true);
    // Content should match
    const original = readFileSync(join(TEST_DIR, 'dev.db'));
    const clone = readFileSync(clonePath);
    expect(clone.toString()).toBe(original.toString());
  });

  it('drops a database file', async () => {
    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    await driver.clone('./dev.db', '.branchdb/snapshots/test.db');
    const testPath = join(TEST_DIR, '.branchdb', 'snapshots', 'test.db');
    expect(existsSync(testPath)).toBe(true);

    await driver.drop('.branchdb/snapshots/test.db');
    expect(existsSync(testPath)).toBe(false);
  });

  it('checks existence', async () => {
    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    expect(await driver.exists('./dev.db')).toBe(true);
    expect(await driver.exists('.branchdb/snapshots/nonexistent.db')).toBe(
      false
    );
  });

  it('lists snapshot databases', async () => {
    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    await driver.clone('./dev.db', '.branchdb/snapshots/branch1.db');
    await driver.clone('./dev.db', '.branchdb/snapshots/branch2.db');

    const items = await driver.list();
    expect(items).toContain('branch1.db');
    expect(items).toContain('branch2.db');
  });

  it('reports file size', async () => {
    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    const sz = await driver.size('./dev.db');
    expect(sz).toBeGreaterThan(0);
  });

  it('reports 0 for missing file', async () => {
    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    const sz = await driver.size('.branchdb/snapshots/nope.db');
    expect(sz).toBe(0);
  });

  it('ping returns true for existing file', async () => {
    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    expect(await driver.ping()).toBe(true);
  });
});

describe('SQLite Integration: full workflow', () => {
  it('init → clone → switch → list → clean', async () => {
    // 1. Init
    const cfg = config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'main',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    expect(config.exists(TEST_DIR)).toBe(true);
    expect(cfg.branches.main.database).toBe('./dev.db');

    // 2. Clone for feature branch
    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    await driver.clone('./dev.db', '.branchdb/snapshots/feature_auth.db');

    config.setBranch(TEST_DIR, 'feature/auth', {
      database: '.branchdb/snapshots/feature_auth.db',
      url: 'file:.branchdb/snapshots/feature_auth.db',
      createdAt: new Date().toISOString(),
    });

    // 3. Switch - update .env
    const envPath = join(TEST_DIR, '.env');
    env.write(envPath, 'DATABASE_URL', 'file:.branchdb/snapshots/feature_auth.db');
    expect(env.read(envPath, 'DATABASE_URL')).toBe(
      'file:.branchdb/snapshots/feature_auth.db'
    );

    // 4. Switch back to main
    env.write(envPath, 'DATABASE_URL', 'file:./dev.db');
    expect(env.read(envPath, 'DATABASE_URL')).toBe('file:./dev.db');

    // 5. List
    const readCfg = config.read(TEST_DIR);
    expect(Object.keys(readCfg.branches)).toHaveLength(2);
    expect(readCfg.branches['feature/auth']).toBeDefined();

    // 6. Clean
    await driver.drop('.branchdb/snapshots/feature_auth.db');
    config.removeBranch(TEST_DIR, 'feature/auth');

    const afterClean = config.read(TEST_DIR);
    expect(Object.keys(afterClean.branches)).toHaveLength(1);
    expect(afterClean.branches['feature/auth']).toBeUndefined();
  });

  it('reset: drop + re-clone', async () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'main',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);

    // Clone
    await driver.clone('./dev.db', '.branchdb/snapshots/feature_x.db');
    config.setBranch(TEST_DIR, 'feature/x', {
      database: '.branchdb/snapshots/feature_x.db',
      url: 'file:.branchdb/snapshots/feature_x.db',
      createdAt: new Date().toISOString(),
    });

    // Modify the snapshot (simulating schema changes)
    writeFileSync(
      join(TEST_DIR, '.branchdb', 'snapshots', 'feature_x.db'),
      'modified-data'
    );

    // Reset = drop + re-clone
    await driver.drop('.branchdb/snapshots/feature_x.db');
    config.removeBranch(TEST_DIR, 'feature/x');

    await driver.clone('./dev.db', '.branchdb/snapshots/feature_x.db');
    config.setBranch(TEST_DIR, 'feature/x', {
      database: '.branchdb/snapshots/feature_x.db',
      url: 'file:.branchdb/snapshots/feature_x.db',
      createdAt: new Date().toISOString(),
    });

    // Verify reset brought back original data
    const resetContent = readFileSync(
      join(TEST_DIR, '.branchdb', 'snapshots', 'feature_x.db'),
      'utf-8'
    );
    expect(resetContent).toBe('sqlite-data-here');
  });

  it('protect prevents clean', () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'main',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    // Base branch is always protected
    expect(config.isProtected(TEST_DIR, 'main')).toBe(true);

    // Protect a feature branch
    config.addProtected(TEST_DIR, 'staging');
    expect(config.isProtected(TEST_DIR, 'staging')).toBe(true);

    // Unprotect
    config.removeProtected(TEST_DIR, 'staging');
    expect(config.isProtected(TEST_DIR, 'staging')).toBe(false);
  });

  it('multi-branch workflow', async () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'main',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    const envPath = join(TEST_DIR, '.env');

    // Create 3 branches
    for (const branch of ['feature/a', 'feature/b', 'feature/c']) {
      const sanitized = branch.replace(/[^a-z0-9]/g, '_');
      const dbName = `.branchdb/snapshots/${sanitized}.db`;
      await driver.clone('./dev.db', dbName);
      config.setBranch(TEST_DIR, branch, {
        database: dbName,
        url: `file:${dbName}`,
        createdAt: new Date().toISOString(),
      });
    }

    const cfg = config.read(TEST_DIR);
    expect(Object.keys(cfg.branches)).toHaveLength(4); // main + 3

    // Switch between branches
    const branchB = config.getBranch(TEST_DIR, 'feature/b');
    expect(branchB).not.toBeNull();
    env.write(envPath, 'DATABASE_URL', branchB!.url);
    expect(env.read(envPath, 'DATABASE_URL')).toContain('feature_b');

    // Clean one branch
    await driver.drop('.branchdb/snapshots/feature_c.db');
    config.removeBranch(TEST_DIR, 'feature/c');

    const cfgAfter = config.read(TEST_DIR);
    expect(Object.keys(cfgAfter.branches)).toHaveLength(3);
  });
});
