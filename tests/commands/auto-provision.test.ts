import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { config } from '../../src/core/config';
import { env } from '../../src/core/env';
import { SqliteDriver } from '../../src/drivers/sqlite';
import { generateDbName, buildConnectionUrl } from '../../src/utils/helpers';

const TEST_DIR = join(tmpdir(), 'branchdb-test-autoprov-' + Date.now());

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

describe('auto-provision flow (switch --auto)', () => {
  it('auto-clones from base when branch has no DB', async () => {
    const cfg = config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'master',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    const branch = 'feature/new-thing';

    // Simulate auto-provision logic from switch.ts
    const sourceEntry = config.getBranch(TEST_DIR, cfg.baseBranch);
    expect(sourceEntry).not.toBeNull();

    const targetDb = generateDbName(cfg, branch);
    const targetUrl = buildConnectionUrl(cfg.baseUrl, targetDb, cfg.driver);

    const driver = new SqliteDriver('file:./dev.db', TEST_DIR);
    await driver.clone(sourceEntry!.database, targetDb);

    config.setBranch(TEST_DIR, branch, {
      database: targetDb,
      url: targetUrl,
      createdAt: new Date().toISOString(),
    });

    const envPath = join(TEST_DIR, cfg.envFile);
    env.write(envPath, cfg.envKey, targetUrl);

    // Verify
    expect(config.getBranch(TEST_DIR, branch)).not.toBeNull();
    expect(env.read(envPath, 'DATABASE_URL')).toBe(targetUrl);
    expect(existsSync(join(TEST_DIR, targetDb))).toBe(true);
  });

  it('switches to existing DB without cloning', () => {
    const cfg = config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'master',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    // Register a branch that already has a DB
    config.setBranch(TEST_DIR, 'feature/existing', {
      database: '.branchdb/snapshots/feature_existing.db',
      url: 'file:.branchdb/snapshots/feature_existing.db',
      createdAt: new Date().toISOString(),
    });

    const entry = config.getBranch(TEST_DIR, 'feature/existing');
    expect(entry).not.toBeNull();

    // Simulate switch: just write env
    const envPath = join(TEST_DIR, cfg.envFile);
    env.write(envPath, cfg.envKey, entry!.url);

    expect(env.read(envPath, 'DATABASE_URL')).toBe('file:.branchdb/snapshots/feature_existing.db');
  });

  it('falls back to base for base branch with no entry', () => {
    const cfg = config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'master',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    // Base branch should always have an entry from init
    const baseEntry = config.getBranch(TEST_DIR, cfg.baseBranch);
    expect(baseEntry).not.toBeNull();
    expect(baseEntry!.url).toBe('file:./dev.db');
  });
});
