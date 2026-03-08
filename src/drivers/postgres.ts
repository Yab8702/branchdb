import { DbDriver, TableInfo } from './types';

export class PostgresDriver implements DbDriver {
  private connectionUrl: string;

  constructor(connectionUrl: string) {
    this.connectionUrl = connectionUrl;
  }

  /**
   * Get a pg Client connected to the 'postgres' maintenance database.
   * We always connect to 'postgres' for admin operations (CREATE/DROP DATABASE).
   */
  private async getAdminClient() {
    try {
      const pg = await import('pg');
      const Client = pg.default?.Client || pg.Client;
      const parsed = new URL(this.connectionUrl);
      parsed.pathname = '/postgres';
      const client = new Client({ connectionString: parsed.toString() });
      await client.connect();
      return client;
    } catch (err: any) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error(
          'PostgreSQL driver (pg) not found.\n' +
            '  Install it: npm install pg\n' +
            '  Or: pnpm add pg'
        );
      }
      throw err;
    }
  }

  /**
   * Get a pg Client connected to a specific database.
   */
  private async getClientForDb(database: string) {
    const pg = await import('pg');
    const Client = pg.default?.Client || pg.Client;
    const parsed = new URL(this.connectionUrl);
    parsed.pathname = `/${database}`;
    const client = new Client({ connectionString: parsed.toString() });
    await client.connect();
    return client;
  }

  async clone(sourceDb: string, targetDb: string): Promise<void> {
    const client = await this.getAdminClient();
    try {
      // Terminate connections to source database (required for TEMPLATE)
      await client.query(
        `
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `,
        [sourceDb]
      );

      // CREATE DATABASE ... TEMPLATE is instant for local databases
      // It uses filesystem-level copy, not logical dump/restore
      await client.query(
        `CREATE DATABASE "${targetDb}" TEMPLATE "${sourceDb}"`
      );
    } finally {
      await client.end();
    }
  }

  async drop(database: string): Promise<void> {
    const client = await this.getAdminClient();
    try {
      // Terminate any active connections first
      await client.query(
        `
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `,
        [database]
      );

      await client.query(`DROP DATABASE IF EXISTS "${database}"`);
    } finally {
      await client.end();
    }
  }

  async exists(database: string): Promise<boolean> {
    const client = await this.getAdminClient();
    try {
      const result = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [database]
      );
      return result.rows.length > 0;
    } finally {
      await client.end();
    }
  }

  async list(): Promise<string[]> {
    const client = await this.getAdminClient();
    try {
      const result = await client.query(
        "SELECT datname FROM pg_database WHERE datname LIKE '%\\_branchdb\\_%' ESCAPE '\\' ORDER BY datname"
      );
      return result.rows.map((r: any) => r.datname);
    } finally {
      await client.end();
    }
  }

  async size(database: string): Promise<number> {
    const client = await this.getAdminClient();
    try {
      const result = await client.query(
        'SELECT pg_database_size($1) as size',
        [database]
      );
      return parseInt(result.rows[0].size);
    } finally {
      await client.end();
    }
  }

  async disconnect(): Promise<void> {
    // No persistent connection pool to close
  }

  async getSchema(database: string): Promise<TableInfo[]> {
    const client = await this.getClientForDb(database);
    try {
      const tablesResult = await client.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`
      );

      const tables: TableInfo[] = [];
      for (const row of tablesResult.rows) {
        const colsResult = await client.query(
          `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [row.table_name]
        );

        tables.push({
          name: row.table_name,
          columns: colsResult.rows.map((c: any) => ({
            name: c.column_name,
            type: c.data_type,
            nullable: c.is_nullable === 'YES',
            defaultValue: c.column_default,
          })),
        });
      }
      return tables;
    } finally {
      await client.end();
    }
  }

  async ping(): Promise<boolean> {
    try {
      const client = await this.getAdminClient();
      await client.query('SELECT 1');
      await client.end();
      return true;
    } catch {
      return false;
    }
  }
}
