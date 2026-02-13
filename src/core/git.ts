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

const HOOK_MARKER = '# branchdb:auto-switch';

const HOOK_BLOCK = `
${HOOK_MARKER}
# branchdb: auto-switch database on branch checkout
# Remove this hook with: branchdb init --no-hook
if [ "$3" = "1" ]; then
  if command -v npx >/dev/null 2>&1; then
    npx branchdb switch --auto 2>/dev/null || true
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
    const root = exec('git rev-parse --show-toplevel');
    if (!root) throw new Error('Not inside a git repository');
    // Normalize Windows paths
    return root.replace(/\//g, '\\');
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
    const output = exec('git branch --format=%(refname:short)');
    return output
      .split('\n')
      .map((b) => b.trim())
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

  /** Remove branchdb hook from post-checkout */
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
};
