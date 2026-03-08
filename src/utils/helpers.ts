import { execSync } from 'child_process';

/**
 * Execute a shell command and return stdout, or empty string on failure.
 * Errors are swallowed — use execLive() when you need failure propagation.
 */
export function exec(cmd: string, options?: { cwd?: string }): string {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      cwd: options?.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Execute a shell command with live stdio (output goes straight to terminal).
 * Throws on non-zero exit code — use this when the command must succeed.
 */
export function execLive(cmd: string, options?: { cwd?: string }): void {
  execSync(cmd, {
    cwd: options?.cwd,
    stdio: 'inherit',
  });
}

/**
 * Sanitize a git branch name into a safe database identifier.
 * e.g. "feature/auth-flow" → "feature_auth_flow"
 */
export function sanitizeBranchName(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * djb2 hash → 4-char base-36 string. Used for uniqueness suffix when
 * a database name would exceed PostgreSQL's 63-byte identifier limit.
 */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).slice(0, 4).padStart(4, '0');
}

/**
 * Generate the database name for a branch.
 * Centralizes naming logic and handles PostgreSQL's 63-byte identifier limit.
 *
 * PostgreSQL:  myapp_branchdb_feature_auth
 * SQLite:      .branchdb/snapshots/feature_auth.db
 */
export function generateDbName(
  cfg: { driver: 'postgres' | 'sqlite' | 'mysql'; baseUrl: string },
  branch: string
): string {
  const sanitized = sanitizeBranchName(branch);

  if (cfg.driver === 'postgres' || cfg.driver === 'mysql') {
    const { database } = parseConnectionUrl(cfg.baseUrl);
    const prefix = `${database}_branchdb_`;
    const fullName = `${prefix}${sanitized}`;

    // PostgreSQL silently truncates identifiers > 63 bytes, causing collisions.
    // MySQL has a 64-char limit. Both get the same truncation logic.
    if (fullName.length > 63) {
      const hash = shortHash(branch);
      const maxSanitized = 63 - prefix.length - 5; // 5 = '_' + 4-char hash
      return `${prefix}${sanitized.slice(0, maxSanitized)}_${hash}`;
    }

    return fullName;
  }

  return `.branchdb/snapshots/${sanitized}.db`;
}

/**
 * Parse a database connection URL into its components.
 */
export function parseConnectionUrl(url: string): {
  driver: 'postgres' | 'sqlite' | 'mysql';
  database: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
} {
  // SQLite detection
  if (
    url.startsWith('file:') ||
    url.endsWith('.db') ||
    url.endsWith('.sqlite') ||
    url.endsWith('.sqlite3')
  ) {
    const filePath = url.replace(/^file:/, '').split('?')[0];
    return { driver: 'sqlite', database: filePath };
  }

  // PostgreSQL detection
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const parsed = new URL(url);
    return {
      driver: 'postgres',
      database: parsed.pathname.slice(1),
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port) : 5432,
      user: parsed.username || undefined,
      password: parsed.password || undefined,
    };
  }

  // MySQL detection
  if (url.startsWith('mysql://') || url.startsWith('mysql2://')) {
    const normalized = url.replace(/^mysql2:/, 'mysql:');
    const parsed = new URL(normalized);
    return {
      driver: 'mysql',
      database: parsed.pathname.slice(1),
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port) : 3306,
      user: parsed.username || undefined,
      password: parsed.password || undefined,
    };
  }

  throw new Error(
    `Unsupported database URL format: ${url}\n` +
      `  Supported: postgresql://... , mysql://... , or file:./path.db`
  );
}

/**
 * Build a new connection URL with a different database name.
 */
export function buildConnectionUrl(
  original: string,
  newDatabase: string,
  driver: 'postgres' | 'sqlite' | 'mysql'
): string {
  if (driver === 'sqlite') {
    if (original.startsWith('file:')) {
      // Preserve query params (e.g. ?mode=wal)
      const qIdx = original.indexOf('?');
      const params = qIdx > -1 ? original.slice(qIdx) : '';
      return `file:${newDatabase}${params}`;
    }
    return newDatabase;
  }

  // PostgreSQL or MySQL — replace database name in URL
  if (driver === 'mysql' && original.startsWith('mysql2://')) {
    const normalized = original.replace(/^mysql2:/, 'mysql:');
    const parsed = new URL(normalized);
    parsed.pathname = `/${newDatabase}`;
    return parsed.toString().replace(/^mysql:/, 'mysql2:');
  }

  const parsed = new URL(original);
  parsed.pathname = `/${newDatabase}`;
  return parsed.toString();
}

/**
 * Format bytes to human readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
