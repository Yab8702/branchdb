import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { config } from '../../src/core/config';
import { PostgresDriver } from '../../src/drivers/postgres';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * PostgreSQL integration tests.
 *
 * These tests require a running PostgreSQL instance.
 * Set PG_TEST_URL environment variable to run them:
 *
 *   PG_TEST_URL="postgresql://postgres:postgres@localhost:5432/branchdb_test" pnpm test
 *
 * If PG_TEST_URL is not set, these tests are skipped.
 */

const PG_URL = process.env.PG_TEST_URL;
const TEST_DIR = join(tmpdir(), 'branchdb-integ-pg-' + Date.now());
const TEST_DB_BASE = 'branchdb_test_base';
const TEST_DB_BRANCH = 'branchdb_test_branch_feature';

const describeIf = PG_URL ? describe : describe.skip;

describeIf('PostgreSQL Driver', () => {
  let driver: PostgresDriver;

  beforeAll(async () => {
    driver = new PostgresDriver(PG_URL!);
    mkdirSync(TEST_DIR, { recursive: true });

    // Create a test base database if it doesn't exist
    try {
      const exists = await driver.exists(TEST_DB_BASE);
      if (!exists) {
        // Connect to postgres db and create base
        const pg = await import('pg');
        const Client = pg.default?.Client || pg.Client;
        const parsed = new URL(PG_URL!);
        parsed.pathname = '/postgres';
        const client = new Client({ connectionString: parsed.toString() });
        await client.connect();
        await client.query(`CREATE DATABASE "${TEST_DB_BASE}"`);

        // Create a test table in the base
        const baseClient = new Client({
          connectionString: PG_URL!.replace(
            /\/[^/]+$/,
            `/${TEST_DB_BASE}`
          ),
        });
        await baseClient.connect();
        await baseClient.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE
          )
        `);
        await baseClient.query(`
          INSERT INTO users (name, email) VALUES ('test', 'test@test.com')
        `);
        await baseClient.end();
        await client.end();
      }
    } catch (err) {
      console.warn('Could not create PG test base database:', err);
    }
  });

  afterAll(async () => {
    // Cleanup test databases
    try {
      await driver.drop(TEST_DB_BRANCH);
    } catch {
      // May not exist
    }
    try {
      await driver.drop(TEST_DB_BASE);
    } catch {
      // May not exist
    }
    rmSync(TEST_DIR, { recursive: true, force: true });
    await driver.disconnect();
  });

  it('ping returns true', async () => {
    const result = await driver.ping();
    expect(result).toBe(true);
  });

  it('checks database existence', async () => {
    const exists = await driver.exists(TEST_DB_BASE);
    expect(exists).toBe(true);

    const notExists = await driver.exists('nonexistent_db_xyz_123456');
    expect(notExists).toBe(false);
  });

  it('clones a database', async () => {
    // Clean up if exists from previous run
    try {
      await driver.drop(TEST_DB_BRANCH);
    } catch {
      // ignore
    }

    await driver.clone(TEST_DB_BASE, TEST_DB_BRANCH);
    const exists = await driver.exists(TEST_DB_BRANCH);
    expect(exists).toBe(true);
  });

  it('gets database size', async () => {
    const size = await driver.size(TEST_DB_BRANCH);
    expect(size).toBeGreaterThan(0);
  });

  it('gets schema from cloned database', async () => {
    const schema = await driver.getSchema(TEST_DB_BRANCH);
    expect(schema.length).toBeGreaterThan(0);

    const usersTable = schema.find((t) => t.name === 'users');
    expect(usersTable).toBeDefined();
    expect(usersTable!.columns.length).toBeGreaterThan(0);

    const nameCol = usersTable!.columns.find((c) => c.name === 'name');
    expect(nameCol).toBeDefined();
    expect(nameCol!.nullable).toBe(false);
  });

  it('drops a database', async () => {
    await driver.drop(TEST_DB_BRANCH);
    const exists = await driver.exists(TEST_DB_BRANCH);
    expect(exists).toBe(false);
  });

  it('drop is idempotent', async () => {
    await expect(driver.drop(TEST_DB_BRANCH)).resolves.not.toThrow();
  });
});

describeIf('PostgreSQL Integration: full workflow', () => {
  let driver: PostgresDriver;

  beforeAll(async () => {
    driver = new PostgresDriver(PG_URL!);
    mkdirSync(TEST_DIR, { recursive: true });

    // Ensure base exists
    const exists = await driver.exists(TEST_DB_BASE);
    if (!exists) {
      const pg = await import('pg');
      const Client = pg.default?.Client || pg.Client;
      const parsed = new URL(PG_URL!);
      parsed.pathname = '/postgres';
      const client = new Client({ connectionString: parsed.toString() });
      await client.connect();
      await client.query(`CREATE DATABASE "${TEST_DB_BASE}"`);
      await client.end();
    }
  });

  afterAll(async () => {
    try {
      await driver.drop(TEST_DB_BRANCH);
    } catch {
      // ignore
    }
    try {
      await driver.drop(TEST_DB_BASE);
    } catch {
      // ignore
    }
    rmSync(TEST_DIR, { recursive: true, force: true });
    await driver.disconnect();
  });

  it('config + clone + list', async () => {
    config.create({
      root: TEST_DIR,
      driver: 'postgres',
      baseBranch: 'main',
      baseUrl: PG_URL!.replace(/\/[^/]+$/, `/${TEST_DB_BASE}`),
      database: TEST_DB_BASE,
      envFile: '.env',
      envKey: 'DATABASE_URL',
    });

    // Clone
    await driver.clone(TEST_DB_BASE, TEST_DB_BRANCH);

    config.setBranch(TEST_DIR, 'feature/test', {
      database: TEST_DB_BRANCH,
      url: PG_URL!.replace(/\/[^/]+$/, `/${TEST_DB_BRANCH}`),
      createdAt: new Date().toISOString(),
    });

    const cfg = config.read(TEST_DIR);
    expect(Object.keys(cfg.branches)).toHaveLength(2);

    // Verify cloned DB has the schema
    const schema = await driver.getSchema(TEST_DB_BRANCH);
    const usersTable = schema.find((t) => t.name === 'users');
    expect(usersTable).toBeDefined();
  });
});
