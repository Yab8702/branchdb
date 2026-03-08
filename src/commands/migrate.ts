import { execLive } from '../utils/helpers';
import { git } from '../core/git';
import { config } from '../core/config';
import { detectOrm } from '../core/detector';
import { log } from '../utils/logger';
import pc from 'picocolors';

/**
 * Interactive migration commands — used by `branchdb migrate` (manual).
 * These may prompt the user for input (e.g. Prisma asks for a migration name).
 */
function getInteractiveMigrateCommand(orm: string): string | null {
  switch (orm) {
    case 'prisma':
      return 'npx prisma migrate dev';
    case 'drizzle':
      return 'npx drizzle-kit push';
    case 'typeorm':
      return 'npx typeorm migration:run';
    case 'sequelize':
      return 'npx sequelize-cli db:migrate';
    case 'knex':
      return 'npx knex migrate:latest';
    default:
      return null;
  }
}

/**
 * Non-interactive migration commands — used by auto-migrate (hook),
 * `clone --migrate`, and `reset --migrate`.
 * These never prompt. They only apply existing migration files.
 *
 * Key differences from interactive:
 *   prisma:  migrate deploy (not dev — no prompts, no drift reset)
 *   drizzle: drizzle-kit migrate (applies SQL files, not push)
 */
export function getAutoMigrateCommand(orm: string): string | null {
  switch (orm) {
    case 'prisma':
      return 'npx prisma migrate deploy';
    case 'drizzle':
      return 'npx drizzle-kit migrate';
    case 'typeorm':
      return 'npx typeorm migration:run';
    case 'sequelize':
      return 'npx sequelize-cli db:migrate';
    case 'knex':
      return 'npx knex migrate:latest';
    default:
      return null;
  }
}

export async function migrateCommand(options: { command?: string }) {
  const root = git.root();
  const cfg = config.read(root);
  const currentBranch = git.currentBranch();

  const entry = config.getBranch(root, currentBranch);
  if (!entry) {
    log.error(
      `No database for branch ${pc.cyan(currentBranch)}. Run: branchdb clone`
    );
    process.exit(1);
  }

  let cmd = options.command;

  if (!cmd) {
    const detection = detectOrm(root);
    cmd = getInteractiveMigrateCommand(detection.orm) ?? undefined;

    if (!cmd) {
      log.error('Could not detect ORM. Specify the command manually:');
      log.dim('  branchdb migrate --command "npx prisma migrate dev"');
      process.exit(1);
    }

    log.info(`Detected ORM: ${pc.cyan(detection.orm)}`);
  }

  log.info(`Running: ${pc.white(cmd)}`);
  log.dim(`  Database: ${entry.database}`);
  console.log('');

  try {
    execLive(cmd, { cwd: root });
    console.log('');
    log.success('Migration completed.');
  } catch (err: any) {
    console.log('');
    log.error('Migration failed.');
    process.exit(1);
  }
}
