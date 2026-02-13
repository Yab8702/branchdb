import { relative } from 'path';
import { git } from '../core/git';
import { env } from '../core/env';
import { config } from '../core/config';
import { detectOrm } from '../core/detector';
import { parseConnectionUrl } from '../utils/helpers';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function initCommand(options: { hook?: boolean }) {
  log.banner();

  // Step 1: Check git repo
  if (!git.isRepo()) {
    log.error('Not inside a git repository. Run: git init');
    process.exit(1);
  }

  const root = git.root();
  const branch = git.currentBranch();

  log.step(1, 5, 'Detected git repository');
  log.dim(`  Branch: ${pc.cyan(branch)}`);

  // Step 2: Check if already initialized
  if (config.exists(root)) {
    log.warn('branchdb is already initialized in this project.');
    log.dim(`  Config: ${relative(process.cwd(), config.path(root))}`);
    return;
  }

  // Step 3: Detect ORM
  const detection = detectOrm(root);
  log.step(
    2,
    5,
    `Detected ORM: ${pc.cyan(detection.orm === 'none' ? 'none (raw SQL)' : detection.orm)}`
  );

  // Step 4: Find and parse DATABASE_URL
  const envFile = env.findEnvFile(root);
  if (!envFile) {
    log.error('No .env file found. Create one with DATABASE_URL first.');
    log.dim('');
    log.dim('  Example .env:');
    log.dim('  DATABASE_URL="postgresql://localhost:5432/mydb"');
    log.dim('  DATABASE_URL="file:./prisma/dev.db"');
    process.exit(1);
  }

  const dbUrl = env.read(envFile, detection.envKey);
  if (!dbUrl) {
    log.error(`No ${detection.envKey} found in ${relative(root, envFile)}`);
    log.dim(
      `  Add it: ${detection.envKey}="postgresql://localhost:5432/mydb"`
    );
    process.exit(1);
  }

  let parsed;
  try {
    parsed = parseConnectionUrl(dbUrl);
  } catch (err: any) {
    log.error(err.message);
    process.exit(1);
  }

  log.step(3, 5, `Detected database: ${pc.cyan(parsed.driver)}`);
  log.dim(`  Database: ${pc.white(parsed.database)}`);
  log.dim(`  Env file: ${relative(root, envFile)}`);

  // Step 5: Create config
  config.create({
    root,
    driver: parsed.driver,
    baseBranch: branch,
    baseUrl: dbUrl,
    database: parsed.database,
    envFile: relative(root, envFile),
    envKey: detection.envKey,
  });

  log.step(4, 5, 'Created .branchdb/config.json');

  // Step 6: Install git hook
  const noHook = options.hook === false;
  if (!noHook) {
    git.installHook(root);
    log.step(5, 5, 'Installed post-checkout git hook');
  } else {
    log.step(5, 5, pc.dim('Skipped git hook (--no-hook)'));
  }

  // Summary
  console.log('');
  log.success('branchdb initialized!');
  console.log('');
  log.dim('  What happens now:');
  log.dim(
    `  • Branch ${pc.cyan(branch)} → database ${pc.white(parsed.database)}`
  );
  log.dim('  • Switch branches → DATABASE_URL auto-updates');
  log.dim('  • New branches get their own database clone');
  console.log('');
  log.dim('  Next steps:');
  log.dim(`  ${pc.white('branchdb clone')}    Clone DB for current branch`);
  log.dim(`  ${pc.white('branchdb list')}     Show all branch databases`);
  log.dim(`  ${pc.white('branchdb status')}   Show current state`);
  console.log('');
}
