import { Command } from 'commander';
import { initCommand } from './commands/init';
import { switchCommand } from './commands/switch';
import { cloneCommand } from './commands/clone';
import { listCommand } from './commands/list';
import { statusCommand } from './commands/status';
import { cleanCommand } from './commands/clean';
import { diffCommand } from './commands/diff';
import { resetCommand } from './commands/reset';
import { doctorCommand } from './commands/doctor';
import { migrateCommand } from './commands/migrate';
import { protectCommand } from './commands/protect';
import { uninitCommand } from './commands/uninit';
import { promptCommand } from './commands/prompt';
import { urlCommand } from './commands/url';
import { snapshotCommand } from './commands/snapshot';

const program = new Command();

program
  .name('branchdb')
  .description(
    'Every git branch gets its own database. Auto-switch on checkout.'
  )
  .version('0.1.0');

program
  .command('init')
  .description('Initialize branchdb in your project')
  .option('--no-hook', 'Skip installing the git post-checkout hook')
  .option('--auto-migrate', 'Enable auto-migration on branch checkout')
  .action(initCommand);

program
  .command('uninit')
  .description('Remove branchdb from your project')
  .option('--force', 'Required to confirm the operation')
  .option('--drop-databases', 'Also drop all branch databases')
  .action(uninitCommand);

program
  .command('switch')
  .description('Switch DATABASE_URL to match current branch')
  .option('--auto', 'Silent mode (used by git hook)')
  .option('-b, --branch <branch>', 'Switch to a specific branch database')
  .action(switchCommand);

program
  .command('clone')
  .description('Clone a database for the current branch')
  .option(
    '-f, --from <branch>',
    'Source branch to clone from (default: base branch)'
  )
  .option(
    '-t, --to <branch>',
    'Target branch to clone to (default: current branch)'
  )
  .option('-m, --migrate', 'Run ORM migrations after cloning')
  .action(cloneCommand);

program
  .command('list')
  .alias('ls')
  .description('List all branch databases')
  .option('--json', 'Output as JSON')
  .action(listCommand);

program
  .command('status')
  .description('Show current branchdb state and sync status')
  .option('--json', 'Output as JSON')
  .action(statusCommand);

program
  .command('clean')
  .description('Drop a branch database')
  .argument('[branch]', 'Branch to clean (default: current branch)')
  .option('-a, --all', 'Drop ALL non-base branch databases')
  .option('-s, --stale', 'Drop databases for branches that no longer exist locally')
  .option('--force', 'Override protection checks')
  .action((branch: string | undefined, options: { all?: boolean; stale?: boolean; force?: boolean }) =>
    cleanCommand({ branch, ...options })
  );

program
  .command('diff')
  .description('Compare schema between current branch and another')
  .option('-b, --branch <branch>', 'Branch to compare against (default: base)')
  .action(diffCommand);

program
  .command('reset')
  .description('Drop and re-clone database for current branch')
  .option('-f, --from <branch>', 'Clone from specific branch (default: base)')
  .option('--force', 'Allow resetting base branch')
  .option('-m, --migrate', 'Run ORM migrations after reset')
  .action(resetCommand);

program
  .command('doctor')
  .description('Run diagnostics and health checks')
  .action(doctorCommand);

program
  .command('migrate')
  .description('Run ORM migrations on current branch database')
  .option('-c, --command <cmd>', 'Custom migration command to run')
  .action(migrateCommand);

program
  .command('protect')
  .description('Protect a branch database from being cleaned')
  .argument('[branch]', 'Branch to protect (default: current branch)')
  .option('-r, --remove', 'Remove protection from branch')
  .option('-l, --list', 'List all protected branches')
  .action(protectCommand);

program
  .command('prompt')
  .description('Output short DB name for shell PS1 integration')
  .action(promptCommand);

program
  .command('url')
  .description('Print DATABASE_URL for current branch (for piping)')
  .action(urlCommand);

program
  .command('snapshot')
  .description('Save/restore named snapshots of branch databases')
  .option('-n, --name <name>', 'Snapshot name')
  .option('-l, --list', 'List all snapshots')
  .option('-r, --restore <name>', 'Restore a snapshot')
  .option('-d, --delete <name>', 'Delete a snapshot')
  .action(snapshotCommand);

program.parse();
