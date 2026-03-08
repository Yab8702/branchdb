import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface BranchEntry {
  database: string;
  url: string;
  createdAt: string;
}

export type DriverType = 'postgres' | 'sqlite' | 'mysql';

export interface BranchDbConfig {
  version: 1;
  driver: DriverType;
  baseBranch: string;
  baseUrl: string;
  envFile: string;
  envKey: string;
  autoMigrate: boolean;
  protectedBranches: string[];
  branches: Record<string, BranchEntry>;
}

const CONFIG_DIR = '.branchdb';
const CONFIG_FILE = 'config.json';

/**
 * Process-lifetime cache. Safe for a CLI tool where each invocation
 * is a fresh process. Eliminates the N disk reads per command that
 * happen when helpers call config.read() in loops.
 */
const _cache = new Map<string, BranchDbConfig>();

export const config = {
  dir(root: string): string {
    return join(root, CONFIG_DIR);
  },

  path(root: string): string {
    return join(root, CONFIG_DIR, CONFIG_FILE);
  },

  exists(root: string): boolean {
    return existsSync(config.path(root));
  },

  read(root: string): BranchDbConfig {
    const p = config.path(root);
    const cached = _cache.get(p);
    if (cached) return cached;

    if (!existsSync(p)) {
      throw new Error(
        'branchdb not initialized. Run: branchdb init'
      );
    }

    let raw: any;
    try {
      raw = JSON.parse(readFileSync(p, 'utf-8'));
    } catch {
      throw new Error(
        `Invalid config file: ${p}\n  The file is not valid JSON. Delete .branchdb/ and re-run: branchdb init`
      );
    }

    // Validate required fields
    const errors: string[] = [];
    if (!raw.driver || !['postgres', 'sqlite', 'mysql'].includes(raw.driver)) {
      errors.push(`Invalid or missing "driver" (got: ${JSON.stringify(raw.driver)}). Must be "postgres", "sqlite", or "mysql".`);
    }
    if (!raw.baseBranch || typeof raw.baseBranch !== 'string') {
      errors.push('Missing or invalid "baseBranch".');
    }
    if (!raw.baseUrl || typeof raw.baseUrl !== 'string') {
      errors.push('Missing or invalid "baseUrl".');
    }
    if (!raw.envFile || typeof raw.envFile !== 'string') {
      errors.push('Missing or invalid "envFile".');
    }
    if (!raw.envKey || typeof raw.envKey !== 'string') {
      errors.push('Missing or invalid "envKey".');
    }
    if (raw.branches && typeof raw.branches !== 'object') {
      errors.push('"branches" must be an object.');
    }

    if (errors.length > 0) {
      throw new Error(
        `Invalid .branchdb/config.json:\n  ${errors.join('\n  ')}\n  Fix the file manually or delete .branchdb/ and re-run: branchdb init`
      );
    }

    const cfg = raw as BranchDbConfig;
    // Backward compat: old configs won't have these fields
    cfg.autoMigrate = cfg.autoMigrate ?? false;
    cfg.protectedBranches = cfg.protectedBranches ?? [];
    cfg.branches = cfg.branches ?? {};
    _cache.set(p, cfg);
    return cfg;
  },

  write(root: string, cfg: BranchDbConfig): void {
    const dir = config.dir(root);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const p = config.path(root);
    writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
    _cache.set(p, cfg);
  },

  setBranch(root: string, branch: string, entry: BranchEntry): void {
    const cfg = config.read(root);
    cfg.branches[branch] = entry;
    config.write(root, cfg);
  },

  getBranch(root: string, branch: string): BranchEntry | null {
    const cfg = config.read(root);
    return cfg.branches[branch] || null;
  },

  removeBranch(root: string, branch: string): void {
    const cfg = config.read(root);
    delete cfg.branches[branch];
    config.write(root, cfg);
  },

  isProtected(root: string, branch: string): boolean {
    const cfg = config.read(root);
    return (
      branch === cfg.baseBranch ||
      cfg.protectedBranches.includes(branch)
    );
  },

  addProtected(root: string, branch: string): void {
    const cfg = config.read(root);
    if (!cfg.protectedBranches.includes(branch)) {
      cfg.protectedBranches.push(branch);
      config.write(root, cfg);
    }
  },

  removeProtected(root: string, branch: string): void {
    const cfg = config.read(root);
    cfg.protectedBranches = cfg.protectedBranches.filter((b) => b !== branch);
    config.write(root, cfg);
  },

  create(options: {
    root: string;
    driver: DriverType;
    baseBranch: string;
    baseUrl: string;
    database: string;
    envFile: string;
    envKey: string;
  }): BranchDbConfig {
    const cfg: BranchDbConfig = {
      version: 1,
      driver: options.driver,
      baseBranch: options.baseBranch,
      baseUrl: options.baseUrl,
      envFile: options.envFile,
      envKey: options.envKey,
      autoMigrate: false,
      protectedBranches: [],
      branches: {
        [options.baseBranch]: {
          database: options.database,
          url: options.baseUrl,
          createdAt: new Date().toISOString(),
        },
      },
    };
    config.write(options.root, cfg);
    return cfg;
  },

  /** Clear the in-memory cache (used for testing). */
  _clearCache(): void {
    _cache.clear();
  },
};
