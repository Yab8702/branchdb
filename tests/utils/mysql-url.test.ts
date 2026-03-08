import { describe, it, expect } from 'vitest';
import {
  parseConnectionUrl,
  buildConnectionUrl,
  generateDbName,
} from '../../src/utils/helpers';

describe('MySQL URL parsing', () => {
  it('parses mysql:// URL', () => {
    const result = parseConnectionUrl('mysql://user:pass@localhost:3306/mydb');
    expect(result.driver).toBe('mysql');
    expect(result.database).toBe('mydb');
    expect(result.host).toBe('localhost');
    expect(result.port).toBe(3306);
    expect(result.user).toBe('user');
    expect(result.password).toBe('pass');
  });

  it('parses mysql2:// URL', () => {
    const result = parseConnectionUrl('mysql2://user:pass@localhost/mydb');
    expect(result.driver).toBe('mysql');
    expect(result.database).toBe('mydb');
  });

  it('defaults to port 3306', () => {
    const result = parseConnectionUrl('mysql://user@localhost/mydb');
    expect(result.port).toBe(3306);
  });
});

describe('MySQL URL building', () => {
  it('builds new mysql URL with different database', () => {
    const result = buildConnectionUrl(
      'mysql://user:pass@localhost:3306/mydb',
      'mydb_branchdb_feature',
      'mysql'
    );
    expect(result).toContain('mydb_branchdb_feature');
    expect(result).toContain('user:pass');
    expect(result).toContain('localhost');
  });

  it('preserves mysql2:// protocol', () => {
    const result = buildConnectionUrl(
      'mysql2://user:pass@localhost/mydb',
      'mydb_branchdb_feature',
      'mysql'
    );
    expect(result).toMatch(/^mysql2:\/\//);
    expect(result).toContain('mydb_branchdb_feature');
  });
});

describe('MySQL DB name generation', () => {
  it('generates mysql db name like postgres', () => {
    const name = generateDbName(
      { driver: 'mysql', baseUrl: 'mysql://localhost/myapp' },
      'feature/auth'
    );
    expect(name).toBe('myapp_branchdb_feature_auth');
  });

  it('truncates long mysql names', () => {
    const name = generateDbName(
      { driver: 'mysql', baseUrl: 'mysql://localhost/myapp' },
      'feature/this-is-a-very-long-branch-name-that-exceeds-limits'
    );
    expect(name.length).toBeLessThanOrEqual(63);
  });
});
