import { join } from 'path';
import { existsSync } from 'fs';
import { git, HOOK_MARKER } from '../core/git';
import { env } from '../core/env';
import { config } from '../core/config';
import { getDriver } from '../core/driver-factory';
import { exec } from '../utils/helpers';
import { log } from '../utils/logger';
import pc from 'picocolors';

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
}

export async function doctorCommand() {
  const results: CheckResult[] = [];

  // 1. Git repository
  const isGit = git.isRepo();
  results.push({
    label: 'Git repository',
    ok: isGit,
    detail: isGit ? git.root() : 'Not a git repository',
  });

  if (!isGit) {
    printResults(results);
    return;
  }

  const root = git.root();

  // 2. branchdb initialized
  const hasConfig = config.exists(root);
  results.push({
    label: 'branchdb config',
    ok: hasConfig,
    detail: hasConfig
      ? config.path(root)
      : 'Not initialized. Run: branchdb init',
  });

  if (!hasConfig) {
    printResults(results);
    return;
  }

  const cfg = config.read(root);

  // 3. .env file exists
  const envPath = join(root, cfg.envFile);
  const hasEnv = existsSync(envPath);
  results.push({
    label: '.env file',
    ok: hasEnv,
    detail: hasEnv ? cfg.envFile : `Missing: ${cfg.envFile}`,
  });

  // 4. DATABASE_URL set
  const dbUrl = hasEnv ? env.read(envPath, cfg.envKey) : null;
  results.push({
    label: cfg.envKey,
    ok: !!dbUrl,
    detail: dbUrl || `Not set in ${cfg.envFile}`,
  });

  // 5. Current branch has database
  const currentBranch = git.currentBranch();
  const branchEntry = config.getBranch(root, currentBranch);
  results.push({
    label: 'Branch database',
    ok: !!branchEntry,
    detail: branchEntry
      ? `${currentBranch} → ${branchEntry.database}`
      : `No database for ${currentBranch}. Run: branchdb clone`,
  });

  // 6. ENV matches config
  if (dbUrl && branchEntry) {
    const inSync = dbUrl === branchEntry.url;
    results.push({
      label: 'Env sync',
      ok: inSync,
      detail: inSync
        ? 'DATABASE_URL matches branch config'
        : `Mismatch! Run: branchdb switch`,
    });
  }

  // 7. Git hook installed — check the file exists AND contains the marker
  const hookInstalled = git.isHookInstalled(root);
  results.push({
    label: 'Git hook',
    ok: hookInstalled,
    detail: hookInstalled
      ? 'post-checkout hook installed'
      : 'Not installed (or marker missing). Run: branchdb init',
  });

  // 8. Database connection
  const driver = getDriver(cfg, root);
  try {
    const canConnect = await driver.ping();
    results.push({
      label: 'DB connection',
      ok: canConnect,
      detail: canConnect
        ? `${cfg.driver} is reachable`
        : `Cannot connect to ${cfg.driver}`,
    });
  } finally {
    await driver.disconnect();
  }

  // 9. .gitignore has .branchdb
  const gitignorePath = join(root, '.gitignore');
  const isGitignored =
    existsSync(gitignorePath) &&
    require('fs').readFileSync(gitignorePath, 'utf-8').includes('.branchdb');
  results.push({
    label: '.gitignore',
    ok: isGitignored,
    detail: isGitignored
      ? '.branchdb is gitignored'
      : '.branchdb is NOT in .gitignore!',
  });

  // 10. sqlite3 CLI available (required for schema diff on SQLite projects)
  if (cfg.driver === 'sqlite') {
    const hasSqlite3 = exec('sqlite3 --version') !== '';
    results.push({
      label: 'sqlite3 CLI',
      ok: hasSqlite3,
      detail: hasSqlite3
        ? 'sqlite3 is available'
        : 'sqlite3 not found — needed for branchdb diff. Install: https://sqlite.org/download.html',
    });
  }

  printResults(results);
}

function printResults(results: CheckResult[]) {
  console.log('');
  log.info('branchdb doctor — diagnostics');
  console.log('');

  let passing = 0;
  let failing = 0;

  for (const r of results) {
    const icon = r.ok ? pc.green('✓') : pc.red('✗');
    const label = r.ok ? r.label : pc.red(r.label);
    console.log(`  ${icon} ${label}`);
    console.log(`    ${pc.dim(r.detail)}`);
    if (r.ok) passing++;
    else failing++;
  }

  console.log('');
  if (failing === 0) {
    log.success(`All ${passing} checks passed.`);
  } else {
    log.warn(`${passing} passed, ${failing} failed.`);
  }
  console.log('');
}
