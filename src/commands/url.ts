import { git } from '../core/git';
import { config } from '../core/config';

/**
 * Print the DATABASE_URL for the current branch.
 * Designed for piping: `psql $(branchdb url)`
 *
 * Exits with code 1 (no output) if no database is registered.
 */
export function urlCommand() {
  const root = git.root();
  const cfg = config.read(root);
  const branch = git.currentBranch();

  const entry = config.getBranch(root, branch);
  if (!entry) {
    // Fall back to base branch
    const base = config.getBranch(root, cfg.baseBranch);
    if (base) {
      process.stdout.write(base.url);
      return;
    }
    process.exit(1);
  }

  process.stdout.write(entry.url);
}
