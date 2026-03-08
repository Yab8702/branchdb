import { relative } from 'path';
import { git } from '../core/git';
import { env } from '../core/env';
import { config } from '../core/config';
import { detectOrm } from '../core/detector';
import { ensureGitignore } from '../core/gitignore';
import { parseConnectionUrl } from '../utils/helpers';
import { log } from '../utils/logger';
import pc from 'picocolors';

export async function initCommand(options: {
  hook?: boolean;
  autoMigrate?: boolean;
}) {
  log.banner();

  // Step 1: Check git repo
  if (!git.isRepo()) {
    log.error('Not inside a git repository. Run: git init');
    process.exit(1);
  }

  const root = git.root();
  const branch = git.currentBranch();

  // Re-init: update settings on an already-initialized project
  if (config.exists(root)) {
    const cfg = config.read(root);

    // Update autoMigrate if explicitly passed
    if (options.autoMigrate !== undefined) {
      cfg.autoMigrate = options.autoMigrate;
      config.write(root, cfg);
    }

    // Re-install hook (picks up any hook format changes)
    if (options.hook !== false) {
      git.installHook(root);
    }

    log.info('branchdb is already initialized.');
    console.log('');
    log.table([
      ['Config:', relative(process.cwd(), config.path(root))],
      ['Driver:', cfg.driver],
      ['Base branch:', cfg.baseBranch],
      ['Auto-migrate:', cfg.autoMigrate ? pc.green('on') : pc.dim('off')],
      ['Branches:', `${Object.keys(cfg.branches).length} registered`],
    ]);
    console.log('');

    if (options.autoMigrate !== undefined) {
      log.success(
        `Auto-migrate ${cfg.autoMigrate ? 'enabled' : 'disabled'}.`
      );
      if (cfg.autoMigrate) {
        log.dim(
          '  Migrations will run automatically on branch checkout.'
        );
      }
    } else {
      log.dim(
        '  To enable auto-migrate: branchdb init --auto-migrate'
      );
    }
    console.log('');
    return;
  }

  // Fresh init
  log.step(1, 6, 'Detected git repository');
  log.dim(`  Branch: ${pc.cyan(branch)}`);

  // Step 2: Detect ORM
  const detection = detectOrm(root);
  log.step(
    2,
    6,
    `Detected ORM: ${pc.cyan(detection.orm === 'none' ? 'none (raw SQL)' : detection.orm)}`
  );

  // Step 3: Find and parse DATABASE_URL
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

  log.step(3, 6, `Detected database: ${pc.cyan(parsed.driver)}`);
  log.dim(`  Database: ${pc.white(parsed.database)}`);
  log.dim(`  Env file: ${relative(root, envFile)}`);

  // Step 4: Create config
  const cfg = config.create({
    root,
    driver: parsed.driver,
    baseBranch: branch,
    baseUrl: dbUrl,
    database: parsed.database,
    envFile: relative(root, envFile),
    envKey: detection.envKey,
  });

  // Apply autoMigrate if passed
  if (options.autoMigrate) {
    cfg.autoMigrate = true;
    config.write(root, cfg);
  }

  log.step(4, 6, 'Created .branchdb/config.json');

  // Step 5: Add .branchdb to .gitignore
  const addedGitignore = ensureGitignore(root);
  log.step(
    5,
    6,
    addedGitignore
      ? 'Added .branchdb/ to .gitignore'
      : pc.dim('.branchdb/ already in .gitignore')
  );

  // Step 6: Install git hook
  const noHook = options.hook === false;
  if (!noHook) {
    git.installHook(root);
    log.step(6, 6, 'Installed post-checkout git hook');
  } else {
    log.step(6, 6, pc.dim('Skipped git hook (--no-hook)'));
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
  log.dim('  • New branches get their own database automatically');
  if (options.autoMigrate) {
    log.dim('  • Migrations run automatically on branch switch');
  }
  console.log('');
  log.dim('  Next steps:');
  log.dim(`  ${pc.white('branchdb clone')}     Clone DB for current branch`);
  log.dim(`  ${pc.white('branchdb list')}      Show all branch databases`);
  log.dim(`  ${pc.white('branchdb status')}    Show current state`);
  if (!options.autoMigrate) {
    log.dim(
      `  ${pc.white('branchdb init --auto-migrate')}  Enable auto-migration on checkout`
    );
  }
  console.log('');
}
