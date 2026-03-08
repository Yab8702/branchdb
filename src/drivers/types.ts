export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
}

export interface DbDriver {
  /** Clone a database from source to target */
  clone(sourceDb: string, targetDb: string): Promise<void>;

  /** Drop a database */
  drop(database: string): Promise<void>;

  /** Check if a database exists */
  exists(database: string): Promise<boolean>;

  /** List all branchdb-managed databases */
  list(): Promise<string[]>;

  /** Get database size in bytes */
  size(database: string): Promise<number>;

  /** Get schema info (tables + columns) for a database */
  getSchema(database: string): Promise<TableInfo[]>;

  /** Test that the connection works */
  ping(): Promise<boolean>;

  /** Cleanup connections */
  disconnect(): Promise<void>;
}
