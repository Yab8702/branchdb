import { DbDriver, TableInfo } from './types';
import { exec } from '../utils/helpers';

export class MysqlDriver implements DbDriver {
  private connectionUrl: string;

  constructor(connectionUrl: string) {
    this.connectionUrl = connectionUrl;
  }

  private parsed() {
    const parsed = new URL(this.connectionUrl);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port) : 3306,
      user: parsed.username || 'root',
      password: parsed.password || '',
      database: parsed.pathname.slice(1),
    };
  }

  /**
   * Get a mysql2 connection to a specific database.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getConnection(database?: string): Promise<any> {
    try {
      // Dynamic import — mysql2 is an optional dependency
      const mysql2: any = await (Function('return import("mysql2/promise")')());
      const createConnection = mysql2.default?.createConnection || mysql2.createConnection;
      const p = this.parsed();
      const conn = await createConnection({
        host: p.host,
        port: p.port,
        user: p.user,
        password: p.password,
        database: database || p.database,
      });
      return conn;
    } catch (err: any) {
      if (err.code === 'MODULE_NOT_FOUND' || err.message?.includes('mysql2')) {
        throw new Error(
          'MySQL driver (mysql2) not found.\n' +
            '  Install it: npm install mysql2\n' +
            '  Or: pnpm add mysql2'
        );
      }
      throw err;
    }
  }

  async clone(sourceDb: string, targetDb: string): Promise<void> {
    // MySQL doesn't have CREATE DATABASE ... TEMPLATE like PostgreSQL.
    // We use mysqldump | mysql which works universally.
    const p = this.parsed();

    // Build auth flags
    const authFlags = [
      `-h ${p.host}`,
      `-P ${p.port}`,
      `-u ${p.user}`,
      p.password ? `-p${p.password}` : '',
    ].filter(Boolean).join(' ');

    // Create target database
    const conn = await this.getConnection(undefined);
    try {
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\``);
    } finally {
      await conn.end();
    }

    // Dump source and pipe into target
    const cmd = `mysqldump ${authFlags} --routines --triggers --events "${sourceDb}" | mysql ${authFlags} "${targetDb}"`;
    const result = exec(cmd);
    if (result === '' && !(await this.exists(targetDb))) {
      throw new Error(`Failed to clone database: mysqldump/mysql command failed`);
    }
  }

  async drop(database: string): Promise<void> {
    const conn = await this.getConnection(undefined);
    try {
      await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
    } finally {
      await conn.end();
    }
  }

  async exists(database: string): Promise<boolean> {
    const conn = await this.getConnection(undefined);
    try {
      const [rows] = await conn.query(
        'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
        [database]
      );
      return (rows as any[]).length > 0;
    } finally {
      await conn.end();
    }
  }

  async list(): Promise<string[]> {
    const conn = await this.getConnection(undefined);
    try {
      const [rows] = await conn.query(
        "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME LIKE '%\\_branchdb\\_%'"
      );
      return (rows as any[]).map((r: any) => r.SCHEMA_NAME);
    } finally {
      await conn.end();
    }
  }

  async size(database: string): Promise<number> {
    const conn = await this.getConnection(undefined);
    try {
      const [rows] = await conn.query(
        `SELECT SUM(data_length + index_length) as size
         FROM information_schema.tables
         WHERE table_schema = ?`,
        [database]
      );
      return parseInt((rows as any[])[0]?.size) || 0;
    } finally {
      await conn.end();
    }
  }

  async getSchema(database: string): Promise<TableInfo[]> {
    const conn = await this.getConnection(database);
    try {
      const [tableRows] = await conn.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY TABLE_NAME`,
        [database]
      );

      const tables: TableInfo[] = [];
      for (const row of tableRows as any[]) {
        const [colRows] = await conn.query(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [database, row.TABLE_NAME]
        );

        tables.push({
          name: row.TABLE_NAME,
          columns: (colRows as any[]).map((c: any) => ({
            name: c.COLUMN_NAME,
            type: c.DATA_TYPE,
            nullable: c.IS_NULLABLE === 'YES',
            defaultValue: c.COLUMN_DEFAULT,
          })),
        });
      }
      return tables;
    } finally {
      await conn.end();
    }
  }

  async ping(): Promise<boolean> {
    try {
      const conn = await this.getConnection(undefined);
      await conn.query('SELECT 1');
      await conn.end();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // No persistent connection pool
  }
}
