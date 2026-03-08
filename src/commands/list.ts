import { git } from '../core/git';
import { config } from '../core/config';
import { getDriver } from '../core/driver-factory';
import { formatBytes } from '../utils/helpers';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function listCommand(options: { json?: boolean }) {
  const root = git.root();
  const cfg = config.read(root);
  const currentBranch = git.currentBranch();

  const branches = Object.entries(cfg.branches);

  if (branches.length === 0) {
    if (options.json) {
      console.log(JSON.stringify([]));
    } else {
      log.info('No branch databases registered.');
    }
    return;
  }

  // Fetch sizes from the driver
  const driver = getDriver(cfg, root);
  const sizeMap = new Map<string, number>();
  try {
    await Promise.all(
      branches.map(async ([, entry]) => {
        try {
          const sz = await driver.size(entry.database);
          sizeMap.set(entry.database, sz);
        } catch {
          sizeMap.set(entry.database, 0);
        }
      })
    );
  } finally {
    await driver.disconnect();
  }

  if (options.json) {
    const output = branches.map(([branch, entry]) => ({
      branch,
      database: entry.database,
      url: entry.url,
      size: sizeMap.get(entry.database) ?? 0,
      createdAt: entry.createdAt,
      active: branch === currentBranch,
      base: branch === cfg.baseBranch,
      protected: cfg.protectedBranches.includes(branch) || branch === cfg.baseBranch,
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log('');
  log.info(`${branches.length} branch database(s):`);
  console.log('');

  for (const [branch, entry] of branches) {
    const isCurrent = branch === currentBranch;
    const isBase = branch === cfg.baseBranch;
    const isProtected = cfg.protectedBranches.includes(branch);
    const size = sizeMap.get(entry.database) ?? 0;

    const marker = isCurrent ? pc.green('→ ') : '  ';
    const name = isCurrent ? pc.green(pc.bold(branch)) : branch;

    const tags: string[] = [];
    if (isBase) tags.push(pc.dim('(base)'));
    if (isCurrent) tags.push(pc.green('(active)'));
    if (isProtected) tags.push(pc.yellow('(protected)'));

    const age = formatAge(entry.createdAt);

    console.log(`${marker}${name} ${tags.join(' ')}`);
    console.log(`    ${pc.dim('db:')}   ${entry.database}`);
    console.log(`    ${pc.dim('size:')} ${formatBytes(size)}  ${pc.dim(age)}`);
  }

  console.log('');
}

function formatAge(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
