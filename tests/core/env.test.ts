import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { env } from '../../src/core/env';

const TEST_DIR = join(tmpdir(), 'branchdb-test-env-' + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('env.read', () => {
  it('reads a simple key=value', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(envFile, 'DATABASE_URL=postgres://localhost/db\n');
    expect(env.read(envFile, 'DATABASE_URL')).toBe('postgres://localhost/db');
  });

  it('reads double-quoted values', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(envFile, 'DATABASE_URL="postgres://localhost/db"\n');
    expect(env.read(envFile, 'DATABASE_URL')).toBe('postgres://localhost/db');
  });

  it('reads single-quoted values', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(envFile, "DATABASE_URL='postgres://localhost/db'\n");
    expect(env.read(envFile, 'DATABASE_URL')).toBe('postgres://localhost/db');
  });

  it('returns null for missing key', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(envFile, 'OTHER_KEY=value\n');
    expect(env.read(envFile, 'DATABASE_URL')).toBeNull();
  });

  it('returns null for missing file', () => {
    expect(env.read(join(TEST_DIR, 'nonexistent'), 'KEY')).toBeNull();
  });

  it('ignores comments', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(
      envFile,
      '# This is a comment\nDATABASE_URL=value\n# Another\n'
    );
    expect(env.read(envFile, 'DATABASE_URL')).toBe('value');
  });

  it('handles multiple keys', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(
      envFile,
      'KEY1=value1\nDATABASE_URL=mydb\nKEY2=value2\n'
    );
    expect(env.read(envFile, 'DATABASE_URL')).toBe('mydb');
    expect(env.read(envFile, 'KEY1')).toBe('value1');
    expect(env.read(envFile, 'KEY2')).toBe('value2');
  });
});

describe('env.write', () => {
  it('creates new file with key', () => {
    const envFile = join(TEST_DIR, '.env-new');
    env.write(envFile, 'DATABASE_URL', 'postgres://localhost/db');
    expect(readFileSync(envFile, 'utf-8')).toContain(
      'DATABASE_URL="postgres://localhost/db"'
    );
  });

  it('updates existing key', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(envFile, 'DATABASE_URL="old_value"\n');
    env.write(envFile, 'DATABASE_URL', 'new_value');
    const content = readFileSync(envFile, 'utf-8');
    expect(content).toContain('DATABASE_URL="new_value"');
    expect(content).not.toContain('old_value');
  });

  it('preserves other keys', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(envFile, 'KEY1=value1\nDATABASE_URL="old"\nKEY2=value2\n');
    env.write(envFile, 'DATABASE_URL', 'new');
    const content = readFileSync(envFile, 'utf-8');
    expect(content).toContain('KEY1=value1');
    expect(content).toContain('KEY2=value2');
    expect(content).toContain('DATABASE_URL="new"');
  });

  it('preserves single quote style', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(envFile, "DATABASE_URL='old'\n");
    env.write(envFile, 'DATABASE_URL', 'new');
    const content = readFileSync(envFile, 'utf-8');
    expect(content).toContain("DATABASE_URL='new'");
  });

  it('appends if key not found', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(envFile, 'KEY1=value1\n');
    env.write(envFile, 'NEW_KEY', 'new_value');
    const content = readFileSync(envFile, 'utf-8');
    expect(content).toContain('KEY1=value1');
    expect(content).toContain('NEW_KEY="new_value"');
  });

  it('preserves comments', () => {
    const envFile = join(TEST_DIR, '.env');
    writeFileSync(
      envFile,
      '# Comment\nDATABASE_URL="old"\n# Another comment\n'
    );
    env.write(envFile, 'DATABASE_URL', 'new');
    const content = readFileSync(envFile, 'utf-8');
    expect(content).toContain('# Comment');
    expect(content).toContain('# Another comment');
  });
});

describe('env.findEnvFile', () => {
  it('finds .env file', () => {
    writeFileSync(join(TEST_DIR, '.env'), '');
    expect(env.findEnvFile(TEST_DIR)).toBe(join(TEST_DIR, '.env'));
  });

  it('finds .env.local file', () => {
    writeFileSync(join(TEST_DIR, '.env.local'), '');
    expect(env.findEnvFile(TEST_DIR)).toBe(join(TEST_DIR, '.env.local'));
  });

  it('prefers .env over .env.local', () => {
    writeFileSync(join(TEST_DIR, '.env'), '');
    writeFileSync(join(TEST_DIR, '.env.local'), '');
    expect(env.findEnvFile(TEST_DIR)).toBe(join(TEST_DIR, '.env'));
  });

  it('returns null when no env file', () => {
    expect(env.findEnvFile(TEST_DIR)).toBeNull();
  });
});
