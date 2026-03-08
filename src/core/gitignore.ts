import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const BRANCHDB_MARKER = '# branchdb';
const BRANCHDB_ENTRIES = ['.branchdb/', '.branchdb/snapshots/'];

/**
 * Ensure .branchdb/ is in .gitignore
 */
export function ensureGitignore(root: string): boolean {
  const gitignorePath = join(root, '.gitignore');

  if (!existsSync(gitignorePath)) {
    writeFileSync(
      gitignorePath,
      `${BRANCHDB_MARKER}\n${BRANCHDB_ENTRIES.join('\n')}\n`
    );
    return true;
  }

  const content = readFileSync(gitignorePath, 'utf-8');

  // Check if already has branchdb entries
  if (content.includes('.branchdb')) {
    return false; // Already managed
  }

  // Append branchdb entries
  const newContent =
    content.trimEnd() +
    '\n\n' +
    `${BRANCHDB_MARKER}\n${BRANCHDB_ENTRIES.join('\n')}\n`;

  writeFileSync(gitignorePath, newContent);
  return true;
}

/**
 * Remove branchdb entries from .gitignore.
 */
export function removeFromGitignore(root: string): void {
  const gitignorePath = join(root, '.gitignore');
  if (!existsSync(gitignorePath)) return;

  const content = readFileSync(gitignorePath, 'utf-8');
  if (!content.includes(BRANCHDB_MARKER)) return;

  const cleaned = content
    .replace(/\n?# branchdb\n\.branchdb\/\n\.branchdb\/snapshots\/\n?/g, '')
    .trim();

  writeFileSync(gitignorePath, cleaned ? cleaned + '\n' : '');
}
