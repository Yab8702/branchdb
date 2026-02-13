import {
  copyFileSync,
  existsSync,
  unlinkSync,
  statSync,
  readdirSync,
  mkdirSync,
} from 'fs';
import { join, dirname } from 'path';
import { DbDriver } from './types';

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
}
