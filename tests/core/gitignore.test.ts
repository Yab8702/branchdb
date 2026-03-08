import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureGitignore, removeFromGitignore } from '../../src/core/gitignore';

const TEST_DIR = join(tmpdir(), 'branchdb-test-gitignore-' + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('ensureGitignore', () => {
  it('creates .gitignore with branchdb entries', () => {
    ensureGitignore(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    expect(content).toContain('.branchdb/');
  });

  it('appends to existing .gitignore', () => {
    writeFileSync(join(TEST_DIR, '.gitignore'), 'node_modules/\n');
    ensureGitignore(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.branchdb/');
  });

  it('does not duplicate entries', () => {
    writeFileSync(join(TEST_DIR, '.gitignore'), '.branchdb/\n');
    const result = ensureGitignore(TEST_DIR);
    expect(result).toBe(false); // no change
  });

  it('returns true when entries added', () => {
    const result = ensureGitignore(TEST_DIR);
    expect(result).toBe(true);
  });
});

describe('removeFromGitignore', () => {
  it('removes branchdb entries', () => {
    writeFileSync(
      join(TEST_DIR, '.gitignore'),
      'node_modules/\n\n# branchdb\n.branchdb/\n.branchdb/snapshots/\n'
    );
    removeFromGitignore(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    expect(content).not.toContain('.branchdb');
    expect(content).toContain('node_modules/');
  });

  it('does nothing when no .gitignore', () => {
    expect(() => removeFromGitignore(TEST_DIR)).not.toThrow();
  });

  it('does nothing when no branchdb entries', () => {
    writeFileSync(join(TEST_DIR, '.gitignore'), 'node_modules/\n');
    removeFromGitignore(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
  });
});
