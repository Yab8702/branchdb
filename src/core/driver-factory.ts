import { PostgresDriver } from '../drivers/postgres';
import { SqliteDriver } from '../drivers/sqlite';
import { MysqlDriver } from '../drivers/mysql';
import type { DbDriver } from '../drivers/types';

/**
 * Create the appropriate database driver based on config.
 */
export function getDriver(
  cfg: { driver: 'postgres' | 'sqlite' | 'mysql'; baseUrl: string },
  root: string
): DbDriver {
  if (cfg.driver === 'postgres') {
    return new PostgresDriver(cfg.baseUrl);
  }
  if (cfg.driver === 'mysql') {
    return new MysqlDriver(cfg.baseUrl);
  }
  return new SqliteDriver(cfg.baseUrl, root);
}
