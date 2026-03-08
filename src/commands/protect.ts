import { git } from '../core/git';
import { config } from '../core/config';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function protectCommand(
  branch: string | undefined,
  options: { remove?: boolean; list?: boolean }
) {
  const root = git.root();
  const cfg = config.read(root);

  if (options.list) {
    const allProtected = [cfg.baseBranch, ...cfg.protectedBranches];
    console.log('');
    log.info(`Protected branches (${allProtected.length}):`);
    console.log('');
    for (const b of allProtected) {
      const isBase = b === cfg.baseBranch;
      console.log(
        `  ${pc.yellow('🔒')} ${b}${isBase ? pc.dim(' (base — always protected)') : ''}`
      );
    }
    console.log('');
    return;
  }

  if (!branch) {
    branch = git.currentBranch();
  }

  if (branch === cfg.baseBranch) {
    log.info(`${pc.cyan(branch)} is the base branch — always protected.`);
    return;
  }

  if (options.remove) {
    config.removeProtected(root, branch);
    log.success(`Removed protection from ${pc.cyan(branch)}.`);
    return;
  }

  config.addProtected(root, branch);
  log.success(`Branch ${pc.cyan(branch)} is now protected.`);
  log.dim('  Its database cannot be dropped with branchdb clean.');
}
