import { describe, it, expect } from 'vitest';
import {
  sanitizeBranchName,
  parseConnectionUrl,
  buildConnectionUrl,
  formatBytes,
  exec,
} from '../../src/utils/helpers';

describe('sanitizeBranchName', () => {
  it('converts slashes to underscores', () => {
    expect(sanitizeBranchName('feature/auth')).toBe('feature_auth');
  });

  it('converts hyphens to underscores', () => {
    expect(sanitizeBranchName('fix-payment')).toBe('fix_payment');
  });

  it('converts dots to underscores', () => {
    expect(sanitizeBranchName('release.1.0')).toBe('release_1_0');
  });

  it('handles complex branch names', () => {
    expect(sanitizeBranchName('feature/auth-v2/fix')).toBe(
      'feature_auth_v2_fix'
    );
  });

  it('lowercases everything', () => {
    expect(sanitizeBranchName('Feature/AUTH')).toBe('feature_auth');
  });

  it('collapses multiple underscores', () => {
    expect(sanitizeBranchName('feature//auth')).toBe('feature_auth');
  });

  it('strips leading/trailing underscores', () => {
    expect(sanitizeBranchName('/feature/')).toBe('feature');
  });

  it('handles main/master', () => {
    expect(sanitizeBranchName('main')).toBe('main');
    expect(sanitizeBranchName('master')).toBe('master');
  });
});

describe('parseConnectionUrl', () => {
  it('parses postgresql URL', () => {
    const result = parseConnectionUrl(
      'postgresql://user:pass@localhost:5432/mydb'
    );
    expect(result.driver).toBe('postgres');
    expect(result.database).toBe('mydb');
    expect(result.host).toBe('localhost');
    expect(result.port).toBe(5432);
    expect(result.user).toBe('user');
    expect(result.password).toBe('pass');
  });

  it('parses postgres:// URL', () => {
    const result = parseConnectionUrl('postgres://localhost:5432/testdb');
    expect(result.driver).toBe('postgres');
    expect(result.database).toBe('testdb');
  });

  it('parses postgresql URL with default port', () => {
    const result = parseConnectionUrl('postgresql://localhost/mydb');
    expect(result.driver).toBe('postgres');
    expect(result.port).toBe(5432);
  });

  it('parses SQLite file: URL', () => {
    const result = parseConnectionUrl('file:./dev.db');
    expect(result.driver).toBe('sqlite');
    expect(result.database).toBe('./dev.db');
  });

  it('parses .db file path', () => {
    const result = parseConnectionUrl('./prisma/dev.db');
    expect(result.driver).toBe('sqlite');
    expect(result.database).toBe('./prisma/dev.db');
  });

  it('parses .sqlite file path', () => {
    const result = parseConnectionUrl('data.sqlite');
    expect(result.driver).toBe('sqlite');
    expect(result.database).toBe('data.sqlite');
  });

  it('parses .sqlite3 file path', () => {
    const result = parseConnectionUrl('data.sqlite3');
    expect(result.driver).toBe('sqlite');
    expect(result.database).toBe('data.sqlite3');
  });

  it('strips query params from sqlite path', () => {
    const result = parseConnectionUrl('file:./dev.db?mode=wal');
    expect(result.database).toBe('./dev.db');
  });

  it('throws on unsupported format', () => {
    expect(() => parseConnectionUrl('mongodb://localhost/db')).toThrow(
      'Unsupported database URL format'
    );
  });
});

describe('buildConnectionUrl', () => {
  it('builds postgres URL with new database', () => {
    const result = buildConnectionUrl(
      'postgresql://user:pass@localhost:5432/mydb',
      'mydb_branchdb_feature_auth',
      'postgres'
    );
    expect(result).toContain('mydb_branchdb_feature_auth');
    expect(result).toContain('localhost');
    expect(result).toContain('user');
  });

  it('builds sqlite file: URL', () => {
    const result = buildConnectionUrl(
      'file:./dev.db',
      '.branchdb/snapshots/feature_auth.db',
      'sqlite'
    );
    expect(result).toBe('file:.branchdb/snapshots/feature_auth.db');
  });

  it('preserves sqlite query params', () => {
    const result = buildConnectionUrl(
      'file:./dev.db?mode=wal',
      '.branchdb/snapshots/test.db',
      'sqlite'
    );
    expect(result).toBe('file:.branchdb/snapshots/test.db?mode=wal');
  });

  it('builds plain sqlite path', () => {
    const result = buildConnectionUrl(
      './dev.db',
      '.branchdb/snapshots/test.db',
      'sqlite'
    );
    expect(result).toBe('.branchdb/snapshots/test.db');
  });
});

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500.0 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });
});

describe('exec', () => {
  it('executes a command and returns stdout', () => {
    const result = exec('echo hello');
    expect(result).toBe('hello');
  });

  it('returns empty string on failure', () => {
    const result = exec('nonexistent_command_xyz_12345');
    expect(result).toBe('');
  });

  it('trims whitespace', () => {
    const result = exec('echo test');
    expect(result).toBe('test');
  });
});
