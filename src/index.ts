import { Command } from 'commander';
import { initCommand } from './commands/init';
import { switchCommand } from './commands/switch';
import { cloneCommand } from './commands/clone';
import { listCommand } from './commands/list';
import { statusCommand } from './commands/status';
import { cleanCommand } from './commands/clean';

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
  .action(initCommand);

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
  .action(cloneCommand);

program
  .command('list')
  .alias('ls')
  .description('List all branch databases')
  .action(listCommand);

program
  .command('status')
  .description('Show current branchdb state and sync status')
  .action(statusCommand);

program
  .command('clean')
  .description('Drop a branch database')
  .argument('[branch]', 'Branch to clean (default: current branch)')
  .option('-a, --all', 'Drop ALL non-base branch databases')
  .action((branch: string | undefined, options: { all?: boolean }) =>
    cleanCommand({ branch, ...options })
  );

program.parse();
