import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface BranchEntry {
  database: string;
  url: string;
  createdAt: string;
}

export interface BranchDbConfig {
  version: 1;
  driver: 'postgres' | 'sqlite';
  baseBranch: string;
  baseUrl: string;
  envFile: string;
  envKey: string;
  branches: Record<string, BranchEntry>;
}

const CONFIG_DIR = '.branchdb';
const CONFIG_FILE = 'config.json';

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
    if (!existsSync(p)) {
      throw new Error(
        'branchdb not initialized. Run: branchdb init'
      );
    }
    return JSON.parse(readFileSync(p, 'utf-8'));
  },

  write(root: string, cfg: BranchDbConfig): void {
    const dir = config.dir(root);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(config.path(root), JSON.stringify(cfg, null, 2) + '\n');
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

  create(options: {
    root: string;
    driver: 'postgres' | 'sqlite';
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
};
