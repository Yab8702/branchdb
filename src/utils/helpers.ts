import { execSync } from 'child_process';

/**
 * Execute a shell command and return stdout, or empty string on failure.
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
 * Parse a database connection URL into its components.
 */
export function parseConnectionUrl(url: string): {
  driver: 'postgres' | 'sqlite';
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

  throw new Error(
    `Unsupported database URL format: ${url}\n` +
      `  Supported: postgresql://... or file:./path.db`
  );
}

/**
 * Build a new connection URL with a different database name.
 */
export function buildConnectionUrl(
  original: string,
  newDatabase: string,
  driver: 'postgres' | 'sqlite'
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

  // PostgreSQL — replace database name in URL
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
