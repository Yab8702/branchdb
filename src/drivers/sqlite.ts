import {
  copyFileSync,
  existsSync,
  unlinkSync,
  statSync,
  readdirSync,
  mkdirSync,
} from 'fs';
import { join, dirname } from 'path';
import { DbDriver, TableInfo } from './types';
import { exec } from '../utils/helpers';

export class SqliteDriver implements DbDriver {
  private snapshotDir: string;

  constructor(
    private connectionUrl: string,
    private projectRoot: string
  ) {
    this.snapshotDir = join(projectRoot, '.branchdb', 'snapshots');

    if (!existsSync(this.snapshotDir)) {
      mkdirSync(this.snapshotDir, { recursive: true });
    }
  }

  /**
   * Resolve a database identifier to an absolute file path.
   * - Relative paths are resolved from projectRoot
   * - Plain filenames are resolved from snapshotDir
   */
  private resolvePath(database: string): string {
    if (
      database.startsWith('/') ||
      database.startsWith('./') ||
      database.startsWith('.\\') ||
      database.startsWith('.branchdb')
    ) {
      return join(this.projectRoot, database);
    }
    return join(this.snapshotDir, database);
  }

  async clone(sourceDb: string, targetDb: string): Promise<void> {
    const sourcePath = this.resolvePath(sourceDb);
    const targetPath = this.resolvePath(targetDb);

    if (!existsSync(sourcePath)) {
      throw new Error(`Source database not found: ${sourcePath}`);
    }

    const targetDir = dirname(targetPath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Copy main database file
    copyFileSync(sourcePath, targetPath);

    // Also copy WAL and SHM journal files if they exist
    for (const suffix of ['-wal', '-shm', '-journal']) {
      const src = sourcePath + suffix;
      if (existsSync(src)) {
        copyFileSync(src, targetPath + suffix);
      }
    }
  }

  async drop(database: string): Promise<void> {
    const dbPath = this.resolvePath(database);

    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const p = dbPath + suffix;
      if (existsSync(p)) {
        unlinkSync(p);
      }
    }
  }

  async exists(database: string): Promise<boolean> {
    return existsSync(this.resolvePath(database));
  }

  async list(): Promise<string[]> {
    if (!existsSync(this.snapshotDir)) return [];

    return readdirSync(this.snapshotDir).filter(
      (f) =>
        f.endsWith('.db') ||
        f.endsWith('.sqlite') ||
        f.endsWith('.sqlite3')
    );
  }

  async size(database: string): Promise<number> {
    const p = this.resolvePath(database);
    if (!existsSync(p)) return 0;
    return statSync(p).size;
  }

  async disconnect(): Promise<void> {
    // Nothing to close for SQLite file operations
  }

  async getSchema(database: string): Promise<TableInfo[]> {
    const dbPath = this.resolvePath(database);
    if (!existsSync(dbPath)) return [];

    // Use sqlite3 CLI to get schema info
    const tablesRaw = exec(
      `sqlite3 "${dbPath}" ".tables"`,
      { cwd: this.projectRoot }
    );
    if (!tablesRaw) return [];

    const tableNames = tablesRaw
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const tables: TableInfo[] = [];
    for (const name of tableNames) {
      const pragmaRaw = exec(
        `sqlite3 "${dbPath}" "PRAGMA table_info(${name});"`,
        { cwd: this.projectRoot }
      );

      if (!pragmaRaw) {
        tables.push({ name, columns: [] });
        continue;
      }

      // PRAGMA table_info returns: cid|name|type|notnull|dflt_value|pk
      const columns = pragmaRaw.split('\n').map((line) => {
        const parts = line.split('|');
        return {
          name: parts[1] || '',
          type: parts[2] || '',
          nullable: parts[3] !== '1',
          defaultValue: parts[4] || null,
        };
      }).filter(c => c.name);

      tables.push({ name, columns });
    }
    return tables;
  }

  async ping(): Promise<boolean> {
    // SQLite is always "available" if the file exists
    const parsed = this.connectionUrl.replace(/^file:/, '').split('?')[0];
    const p = join(this.projectRoot, parsed);
    return existsSync(p);
  }
}
