import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { config, BranchDbConfig } from '../../src/core/config';

const TEST_DIR = join(tmpdir(), 'branchdb-test-config-' + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  // Clear the in-process cache so tests don't bleed into each other.
  // In production each CLI invocation is a fresh process, so the cache
  // is always empty at the start of a command.
  config._clearCache();
});

describe('config', () => {
  it('creates config correctly', () => {
    const cfg = config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'main',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    expect(cfg.version).toBe(1);
    expect(cfg.driver).toBe('sqlite');
    expect(cfg.baseBranch).toBe('main');
    expect(cfg.baseUrl).toBe('file:./dev.db');
    expect(cfg.protectedBranches).toEqual([]);
    expect(cfg.branches.main).toBeDefined();
    expect(cfg.branches.main.database).toBe('./dev.db');
  });

  it('exists returns true after create', () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'main',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    expect(config.exists(TEST_DIR)).toBe(true);
  });

  it('exists returns false before create', () => {
    expect(config.exists(TEST_DIR)).toBe(false);
  });

  it('reads config correctly', () => {
    config.create({
      root: TEST_DIR,
      driver: 'postgres',
      baseBranch: 'main',
      baseUrl: 'postgresql://localhost/db',
      database: 'db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    const cfg = config.read(TEST_DIR);
    expect(cfg.driver).toBe('postgres');
    expect(cfg.baseBranch).toBe('main');
  });

  it('throws when reading non-existent config', () => {
    expect(() => config.read(TEST_DIR)).toThrow('branchdb not initialized');
  });

  it('sets and gets branch entries', () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'main',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    config.setBranch(TEST_DIR, 'feature/auth', {
      database: '.branchdb/snapshots/feature_auth.db',
      url: 'file:.branchdb/snapshots/feature_auth.db',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const entry = config.getBranch(TEST_DIR, 'feature/auth');
    expect(entry).not.toBeNull();
    expect(entry!.database).toBe('.branchdb/snapshots/feature_auth.db');
  });

  it('returns null for unknown branch', () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'main',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    expect(config.getBranch(TEST_DIR, 'nonexistent')).toBeNull();
  });

  it('removes branch entries', () => {
    config.create({
      root: TEST_DIR,
      driver: 'sqlite',
      baseBranch: 'main',
      baseUrl: 'file:./dev.db',
      database: './dev.db',
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    config.setBranch(TEST_DIR, 'feature/x', {
      database: 'test.db',
      url: 'file:test.db',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    config.removeBranch(TEST_DIR, 'feature/x');
    expect(config.getBranch(TEST_DIR, 'feature/x')).toBeNull();
  });

  describe('protection', () => {
    beforeEach(() => {
      config.create({
        root: TEST_DIR,
        driver: 'sqlite',
        baseBranch: 'main',
        baseUrl: 'file:./dev.db',
        database: './dev.db',
        envFile: '.env',
        envKey: 'DATABASE_URL',
      });
    });

    it('base branch is always protected', () => {
      expect(config.isProtected(TEST_DIR, 'main')).toBe(true);
    });

    it('non-base branch is not protected by default', () => {
      expect(config.isProtected(TEST_DIR, 'feature/x')).toBe(false);
    });

    it('adds protection', () => {
      config.addProtected(TEST_DIR, 'staging');
      expect(config.isProtected(TEST_DIR, 'staging')).toBe(true);
    });

    it('removes protection', () => {
      config.addProtected(TEST_DIR, 'staging');
      config.removeProtected(TEST_DIR, 'staging');
      expect(config.isProtected(TEST_DIR, 'staging')).toBe(false);
    });

    it('does not duplicate protection', () => {
      config.addProtected(TEST_DIR, 'staging');
      config.addProtected(TEST_DIR, 'staging');
      const cfg = config.read(TEST_DIR);
      expect(
        cfg.protectedBranches.filter((b) => b === 'staging').length
      ).toBe(1);
    });
  });
});
