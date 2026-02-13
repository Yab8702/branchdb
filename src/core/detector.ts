import { existsSync } from 'fs';
import { join } from 'path';

export type OrmType =
  | 'prisma'
  | 'drizzle'
  | 'typeorm'
  | 'sequelize'
  | 'knex'
  | 'none';

export interface DetectionResult {
  orm: OrmType;
  envKey: string;
}

/**
 * Auto-detect which ORM is used in the project.
 * This determines the default env variable key and
 * helps provide ORM-specific guidance.
 */
export function detectOrm(root: string): DetectionResult {
  // Prisma
  if (
    existsSync(join(root, 'prisma', 'schema.prisma')) ||
    existsSync(join(root, 'prisma'))
  ) {
    return { orm: 'prisma', envKey: 'DATABASE_URL' };
  }

  // Drizzle
  if (
    existsSync(join(root, 'drizzle.config.ts')) ||
    existsSync(join(root, 'drizzle.config.js')) ||
    existsSync(join(root, 'drizzle.config.mjs'))
  ) {
    return { orm: 'drizzle', envKey: 'DATABASE_URL' };
  }

  // TypeORM
  if (
    existsSync(join(root, 'ormconfig.json')) ||
    existsSync(join(root, 'ormconfig.ts')) ||
    existsSync(join(root, 'ormconfig.js'))
  ) {
    return { orm: 'typeorm', envKey: 'DATABASE_URL' };
  }

  // Sequelize
  if (
    existsSync(join(root, '.sequelizerc')) ||
    existsSync(join(root, 'config', 'config.json'))
  ) {
    return { orm: 'sequelize', envKey: 'DATABASE_URL' };
  }

  // Knex
  if (
    existsSync(join(root, 'knexfile.ts')) ||
    existsSync(join(root, 'knexfile.js'))
  ) {
    return { orm: 'knex', envKey: 'DATABASE_URL' };
  }

  return { orm: 'none', envKey: 'DATABASE_URL' };
}
