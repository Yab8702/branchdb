import { join } from 'path';
import { git } from '../core/git';
import { env } from '../core/env';
import { config } from '../core/config';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function switchCommand(options: {
  auto?: boolean;
  branch?: string;
}) {
  const root = git.root();
  const cfg = config.read(root);
  const branch = options.branch || git.currentBranch();
  const envPath = join(root, cfg.envFile);

  const branchEntry = config.getBranch(root, branch);

  if (branchEntry) {
    // Branch has a registered database — switch to it
    env.write(envPath, cfg.envKey, branchEntry.url);

    if (!options.auto) {
      log.success(`Switched to database for branch ${pc.cyan(branch)}`);
      log.dim(`  ${cfg.envKey}=${branchEntry.url}`);
    }
    return;
  }

  // Branch doesn't have a database yet
  if (options.auto) {
    // In auto mode (git hook), silently fall back to base branch URL
    const baseEntry = config.getBranch(root, cfg.baseBranch);
    if (baseEntry) {
      env.write(envPath, cfg.envKey, baseEntry.url);
    }
    return;
  }

  // Interactive mode — inform user and fall back
  log.warn(`No database registered for branch ${pc.cyan(branch)}`);
  log.dim(`  Using base branch database (${cfg.baseBranch})`);
  log.dim('');
  log.dim(
    `  To create a branch database: ${pc.white(`branchdb clone`)}`
  );

  const baseEntry = config.getBranch(root, cfg.baseBranch);
  if (baseEntry) {
    env.write(envPath, cfg.envKey, baseEntry.url);
  }
}
