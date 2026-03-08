import { git } from '../core/git';
import { config } from '../core/config';
import { getDriver } from '../core/driver-factory';
import { log } from '../utils/logger';
import type { TableInfo } from '../drivers/types';
import pc from 'picocolors';

interface SchemaDiff {
  added: TableInfo[];
  removed: TableInfo[];
  modified: {
    table: string;
    addedColumns: string[];
    removedColumns: string[];
    modifiedColumns: string[];
  }[];
}

function diffSchemas(base: TableInfo[], target: TableInfo[]): SchemaDiff {
  const baseMap = new Map(base.map((t) => [t.name, t]));
  const targetMap = new Map(target.map((t) => [t.name, t]));

  const added = target.filter((t) => !baseMap.has(t.name));
  const removed = base.filter((t) => !targetMap.has(t.name));

  const modified: SchemaDiff['modified'] = [];

  for (const [name, targetTable] of targetMap) {
    const baseTable = baseMap.get(name);
    if (!baseTable) continue;

    const baseColMap = new Map(baseTable.columns.map((c) => [c.name, c]));
    const targetColMap = new Map(
      targetTable.columns.map((c) => [c.name, c])
    );

    const addedColumns = targetTable.columns
      .filter((c) => !baseColMap.has(c.name))
      .map((c) => c.name);
    const removedColumns = baseTable.columns
      .filter((c) => !targetColMap.has(c.name))
      .map((c) => c.name);
    const modifiedColumns = targetTable.columns
      .filter((c) => {
        const baseCol = baseColMap.get(c.name);
        if (!baseCol) return false;
        return (
          baseCol.type !== c.type ||
          baseCol.nullable !== c.nullable ||
          baseCol.defaultValue !== c.defaultValue
        );
      })
      .map((c) => c.name);

    if (
      addedColumns.length ||
      removedColumns.length ||
      modifiedColumns.length
    ) {
      modified.push({
        table: name,
        addedColumns,
        removedColumns,
        modifiedColumns,
      });
    }
  }

  return { added, removed, modified };
}

export async function diffCommand(options: { branch?: string }) {
  const root = git.root();
  const cfg = config.read(root);
  const currentBranch = git.currentBranch();

  const targetBranch = options.branch || cfg.baseBranch;

  if (targetBranch === currentBranch) {
    log.info('Comparing to a different branch. Use: branchdb diff --branch <x>');
    return;
  }

  const currentEntry = config.getBranch(root, currentBranch);
  const targetEntry = config.getBranch(root, targetBranch);

  if (!currentEntry) {
    log.error(`No database for current branch ${pc.cyan(currentBranch)}.`);
    log.dim('  Run: branchdb clone');
    process.exit(1);
  }

  if (!targetEntry) {
    log.error(
      `No database for branch ${pc.cyan(targetBranch)}.`
    );
    process.exit(1);
  }

  const driver = getDriver(cfg, root);

  try {
    log.info(
      `Comparing ${pc.cyan(currentBranch)} ↔ ${pc.cyan(targetBranch)}...`
    );

    const [currentSchema, targetSchema] = await Promise.all([
      driver.getSchema(currentEntry.database),
      driver.getSchema(targetEntry.database),
    ]);

    const diff = diffSchemas(targetSchema, currentSchema);

    const hasChanges =
      diff.added.length > 0 ||
      diff.removed.length > 0 ||
      diff.modified.length > 0;

    if (!hasChanges) {
      console.log('');
      log.success('Schemas are identical.');
      return;
    }

    console.log('');

    if (diff.added.length > 0) {
      log.info(pc.green(`+ ${diff.added.length} new table(s):`));
      for (const t of diff.added) {
        console.log(`  ${pc.green('+')} ${pc.bold(t.name)}`);
        for (const c of t.columns) {
          console.log(
            `    ${pc.green('+')} ${c.name} ${pc.dim(c.type)}${c.nullable ? '' : pc.dim(' NOT NULL')}`
          );
        }
      }
      console.log('');
    }

    if (diff.removed.length > 0) {
      log.info(pc.red(`- ${diff.removed.length} removed table(s):`));
      for (const t of diff.removed) {
        console.log(`  ${pc.red('-')} ${pc.bold(t.name)}`);
        for (const c of t.columns) {
          console.log(`    ${pc.red('-')} ${c.name} ${pc.dim(c.type)}`);
        }
      }
      console.log('');
    }

    if (diff.modified.length > 0) {
      log.info(pc.yellow(`~ ${diff.modified.length} modified table(s):`));
      for (const m of diff.modified) {
        console.log(`  ${pc.yellow('~')} ${pc.bold(m.table)}`);
        for (const col of m.addedColumns) {
          console.log(`    ${pc.green('+')} ${col}`);
        }
        for (const col of m.removedColumns) {
          console.log(`    ${pc.red('-')} ${col}`);
        }
        for (const col of m.modifiedColumns) {
          console.log(`    ${pc.yellow('~')} ${col} (type/default changed)`);
        }
      }
      console.log('');
    }

    log.dim(
      `  Base: ${targetEntry.database} (${targetBranch})`
    );
    log.dim(
      `  Head: ${currentEntry.database} (${currentBranch})`
    );
    console.log('');
  } finally {
    await driver.disconnect();
  }
}
