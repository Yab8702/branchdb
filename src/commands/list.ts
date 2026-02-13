import { git } from '../core/git';
import { config } from '../core/config';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function listCommand() {
  const root = git.root();
  const cfg = config.read(root);
  const currentBranch = git.currentBranch();

  const branches = Object.entries(cfg.branches);

  if (branches.length === 0) {
    log.info('No branch databases registered.');
    return;
  }

  console.log('');
  log.info(`${branches.length} branch database(s):`);
  console.log('');

  for (const [branch, entry] of branches) {
    const isCurrent = branch === currentBranch;
    const isBase = branch === cfg.baseBranch;

    const marker = isCurrent ? pc.green('→ ') : '  ';
    const name = isCurrent ? pc.green(pc.bold(branch)) : branch;
    const tags: string[] = [];

    if (isBase) tags.push(pc.dim('(base)'));
    if (isCurrent) tags.push(pc.green('(active)'));

    console.log(`${marker}${name} ${tags.join(' ')}`);
    console.log(`    ${pc.dim('db:')} ${entry.database}`);
  }

  console.log('');
}
