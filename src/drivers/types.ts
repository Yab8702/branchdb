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

  /** Cleanup connections */
  disconnect(): Promise<void>;
}
