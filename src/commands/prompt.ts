import { git } from '../core/git';
import { config } from '../core/config';

/**
 * Fast PS1 prompt integration.
 * Outputs [db:DBNAME] when on a branch with a registered database.
 * Silent (empty output) when: not in a branchdb project, on base branch,
 * or no database registered for the current branch.
 *
 * Usage in .bashrc/.zshrc:
 *   export PS1='$(branchdb prompt 2>/dev/null) '$PS1
 */
export function promptCommand() {
  try {
    if (!git.isRepo()) return;

    const root = git.root();
    if (!config.exists(root)) return;

    const cfg = config.read(root);
    const branch = git.currentBranch();

    // Silent on base branch — it's the default, no need to show
    if (branch === cfg.baseBranch) return;

    const entry = config.getBranch(root, branch);
    if (!entry) return;

    // Shorten the db name for readability
    let dbShort: string;
    if (cfg.driver === 'sqlite') {
      // SQLite: ".branchdb/snapshots/feature_auth.db" → "feature_auth"
      dbShort = entry.database
        .replace(/^.*\//, '')     // strip path
        .replace(/\.(db|sqlite3?)$/, ''); // strip extension
    } else {
      // PostgreSQL/MySQL: "myapp_branchdb_feature_auth" → "feature_auth"
      dbShort = entry.database.replace(/.*_branchdb_/, '');
    }
    process.stdout.write(`[db:${dbShort}]`);
  } catch {
    // Never crash — this runs on every shell prompt
  }
}
