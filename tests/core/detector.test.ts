import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { detectOrm } from '../../src/core/detector';

const TEST_DIR = join(tmpdir(), 'branchdb-test-detector-' + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('detectOrm', () => {
  it('detects Prisma', () => {
    mkdirSync(join(TEST_DIR, 'prisma'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'prisma', 'schema.prisma'), '');
    const result = detectOrm(TEST_DIR);
    expect(result.orm).toBe('prisma');
    expect(result.envKey).toBe('DATABASE_URL');
  });

  it('detects Drizzle (ts config)', () => {
    writeFileSync(join(TEST_DIR, 'drizzle.config.ts'), '');
    const result = detectOrm(TEST_DIR);
    expect(result.orm).toBe('drizzle');
  });

  it('detects Drizzle (js config)', () => {
    writeFileSync(join(TEST_DIR, 'drizzle.config.js'), '');
    const result = detectOrm(TEST_DIR);
    expect(result.orm).toBe('drizzle');
  });

  it('detects Drizzle (mjs config)', () => {
    writeFileSync(join(TEST_DIR, 'drizzle.config.mjs'), '');
    const result = detectOrm(TEST_DIR);
    expect(result.orm).toBe('drizzle');
  });

  it('detects TypeORM', () => {
    writeFileSync(join(TEST_DIR, 'ormconfig.json'), '{}');
    const result = detectOrm(TEST_DIR);
    expect(result.orm).toBe('typeorm');
  });

  it('detects Sequelize', () => {
    writeFileSync(join(TEST_DIR, '.sequelizerc'), '');
    const result = detectOrm(TEST_DIR);
    expect(result.orm).toBe('sequelize');
  });

  it('detects Knex', () => {
    writeFileSync(join(TEST_DIR, 'knexfile.ts'), '');
    const result = detectOrm(TEST_DIR);
    expect(result.orm).toBe('knex');
  });

  it('returns none for unknown', () => {
    const result = detectOrm(TEST_DIR);
    expect(result.orm).toBe('none');
    expect(result.envKey).toBe('DATABASE_URL');
  });
});
