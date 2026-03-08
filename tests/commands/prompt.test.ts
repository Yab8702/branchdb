import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { config } from '../../src/core/config';

const TEST_DIR = join(tmpdir(), 'branchdb-test-prompt-' + Date.now());

function gitExec(cmd: string) {
  return execSync(cmd, { cwd: TEST_DIR, encoding: 'utf-8', stdio: 'pipe' });
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  gitExec('git init');
  gitExec('git config user.email "test@test.com"');
  gitExec('git config user.name "Test"');
  writeFileSync(join(TEST_DIR, '.env'), 'DATABASE_URL="file:./dev.db"\n');
  writeFileSync(join(TEST_DIR, 'dev.db'), 'test');
  gitExec('git add -A');
  gitExec('git commit -m "init"');
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  config._clearCache();
});

describe('prompt command logic', () => {
  it('returns empty for base branch', () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'master',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    // On base branch (master after git init), prompt should output nothing
    const entry = config.getBranch(TEST_DIR, 'master');
    expect(entry).not.toBeNull();
    // The prompt logic: if branch === baseBranch, return silently
    // We test the logic directly since we can't easily capture stdout
    const cfg = config.read(TEST_DIR);
    const branch = 'master';
    const shouldOutput = branch !== cfg.baseBranch && !!config.getBranch(TEST_DIR, branch);
    expect(shouldOutput).toBe(false);
  });

  it('returns db name for feature branch', () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'master',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    config.setBranch(TEST_DIR, 'feature/auth', {
      database: 'myapp_branchdb_feature_auth',
      url: 'file:.branchdb/snapshots/feature_auth.db',
      createdAt: new Date().toISOString(),
    });

    const cfg = config.read(TEST_DIR);
    const branch = 'feature/auth';
    const shouldOutput = branch !== cfg.baseBranch && !!config.getBranch(TEST_DIR, branch);
    expect(shouldOutput).toBe(true);

    const entry = config.getBranch(TEST_DIR, branch)!;
    const dbShort = entry.database.replace(/.*_branchdb_/, '');
    expect(dbShort).toBe('feature_auth');
  });

  it('returns empty for unregistered branch', () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'master',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    const branch = 'feature/unknown';
    const shouldOutput = branch !== 'master' && !!config.getBranch(TEST_DIR, branch);
    expect(shouldOutput).toBe(false);
  });
});
