import { exec } from '../utils/helpers';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';

export const HOOK_MARKER = '# branchdb:auto-switch';

const HOOK_BLOCK = `
${HOOK_MARKER}
# branchdb: auto-switch database on branch checkout
# Remove this hook with: branchdb uninit
if [ "$3" = "1" ]; then
  if command -v npx >/dev/null 2>&1; then
    npx branchdb switch --auto 2>&1 || true
  fi
fi
# branchdb:end`;

export const git = {
  /** Check if current directory is inside a git repo */
  isRepo(): boolean {
    return exec('git rev-parse --is-inside-work-tree') === 'true';
  },

  /** Get the root directory of the git repo */
  root(): string {
    const raw = exec('git rev-parse --show-toplevel');
    if (!raw) throw new Error('Not inside a git repository');

    // Git on Windows (Git Bash / MINGW) returns Unix-style paths: /c/Users/...
    // Convert to Windows-style: C:\Users\...
    if (process.platform === 'win32') {
      return raw
        .replace(/^\/([a-zA-Z])\//, '$1:\\')
        .replace(/\//g, '\\');
    }

    return raw;
  },

  /** Get the current branch name */
  currentBranch(): string {
    // Try symbolic-ref first (works even with no commits on some setups)
    let branch = exec('git symbolic-ref --short HEAD');
    if (!branch) {
      branch = exec('git rev-parse --abbrev-ref HEAD');
    }
    if (!branch) {
      // Brand new repo with no commits — default to 'main'
      branch = exec('git config init.defaultBranch') || 'main';
    }
    return branch;
  },

  /** List all local branches */
  branches(): string[] {
    const output = exec('git branch --list');
    return output
      .split('\n')
      .map((b) => b.replace(/^\*?\s+/, '').trim())
      .filter(Boolean);
  },

  /** Install post-checkout hook for auto-switching */
  installHook(repoRoot: string): void {
    const hooksDir = join(repoRoot, '.git', 'hooks');
    const hookPath = join(hooksDir, 'post-checkout');

    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }

    if (existsSync(hookPath)) {
      const existing = readFileSync(hookPath, 'utf-8');
      if (existing.includes(HOOK_MARKER)) {
        return; // Already installed
      }
      // Append to existing hook
      writeFileSync(hookPath, existing.trimEnd() + '\n' + HOOK_BLOCK + '\n');
    } else {
      writeFileSync(hookPath, '#!/bin/sh\n' + HOOK_BLOCK + '\n');
    }

    try {
      chmodSync(hookPath, '755');
    } catch {
      // Windows doesn't need chmod
    }
  },

  /** Remove branchdb hook block from post-checkout */
  removeHook(repoRoot: string): void {
    const hookPath = join(repoRoot, '.git', 'hooks', 'post-checkout');
    if (!existsSync(hookPath)) return;

    const content = readFileSync(hookPath, 'utf-8');
    if (!content.includes(HOOK_MARKER)) return;

    // Remove everything between marker and end marker
    const cleaned = content
      .replace(/\n?# branchdb:auto-switch[\s\S]*?# branchdb:end\n?/g, '')
      .trim();

    if (cleaned === '#!/bin/sh' || cleaned === '') {
      unlinkSync(hookPath);
    } else {
      writeFileSync(hookPath, cleaned + '\n');
    }
  },

  /** Check if the branchdb hook block is installed (not just if the file exists) */
  isHookInstalled(repoRoot: string): boolean {
    const hookPath = join(repoRoot, '.git', 'hooks', 'post-checkout');
    if (!existsSync(hookPath)) return false;
    return readFileSync(hookPath, 'utf-8').includes(HOOK_MARKER);
  },
};
