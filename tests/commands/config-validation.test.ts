import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { config } from '../../src/core/config';

const TEST_DIR = join(tmpdir(), 'branchdb-test-validation-' + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  config._clearCache();
});

describe('config validation', () => {
  it('rejects invalid JSON', () => {
    const dir = join(TEST_DIR, '.branchdb');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), '{broken json!!!');

    expect(() => config.read(TEST_DIR)).toThrow('not valid JSON');
  });

  it('rejects missing driver', () => {
    const dir = join(TEST_DIR, '.branchdb');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        version: 1,
        baseBranch: 'main',
        baseUrl: 'file:./dev.db',
        envFile: '.env',
        envKey: 'DATABASE_URL',
        branches: {},
      })
    );

    expect(() => config.read(TEST_DIR)).toThrow('Invalid or missing "driver"');
  });

  it('rejects invalid driver value', () => {
    const dir = join(TEST_DIR, '.branchdb');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        version: 1,
        driver: 'mongodb',
        baseBranch: 'main',
        baseUrl: 'file:./dev.db',
        envFile: '.env',
        envKey: 'DATABASE_URL',
        branches: {},
      })
    );

    expect(() => config.read(TEST_DIR)).toThrow('Invalid or missing "driver"');
  });

  it('rejects missing baseBranch', () => {
    const dir = join(TEST_DIR, '.branchdb');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        version: 1,
        driver: 'sqlite',
        baseUrl: 'file:./dev.db',
        envFile: '.env',
        envKey: 'DATABASE_URL',
        branches: {},
      })
    );

    expect(() => config.read(TEST_DIR)).toThrow('Missing or invalid "baseBranch"');
  });

  it('rejects missing baseUrl', () => {
    const dir = join(TEST_DIR, '.branchdb');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        version: 1,
        driver: 'sqlite',
        baseBranch: 'main',
        envFile: '.env',
        envKey: 'DATABASE_URL',
        branches: {},
      })
    );

    expect(() => config.read(TEST_DIR)).toThrow('Missing or invalid "baseUrl"');
  });

  it('accepts valid config with all fields', () => {
    const dir = join(TEST_DIR, '.branchdb');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        version: 1,
        driver: 'sqlite',
        baseBranch: 'main',
        baseUrl: 'file:./dev.db',
        envFile: '.env',
        envKey: 'DATABASE_URL',
        branches: {
          main: {
            database: './dev.db',
            url: 'file:./dev.db',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        },
      })
    );

    const cfg = config.read(TEST_DIR);
    expect(cfg.driver).toBe('sqlite');
    expect(cfg.autoMigrate).toBe(false); // backward compat default
    expect(cfg.protectedBranches).toEqual([]); // backward compat default
  });

  it('accepts mysql driver', () => {
    const dir = join(TEST_DIR, '.branchdb');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        version: 1,
        driver: 'mysql',
        baseBranch: 'main',
        baseUrl: 'mysql://localhost/mydb',
        envFile: '.env',
        envKey: 'DATABASE_URL',
        branches: {},
      })
    );

    const cfg = config.read(TEST_DIR);
    expect(cfg.driver).toBe('mysql');
  });

  it('normalizes old config missing autoMigrate and protectedBranches', () => {
    const dir = join(TEST_DIR, '.branchdb');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        version: 1,
        driver: 'postgres',
        baseBranch: 'main',
        baseUrl: 'postgresql://localhost/mydb',
        envFile: '.env',
        envKey: 'DATABASE_URL',
        branches: {},
      })
    );

    const cfg = config.read(TEST_DIR);
    expect(cfg.autoMigrate).toBe(false);
    expect(cfg.protectedBranches).toEqual([]);
  });
});
