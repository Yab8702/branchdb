import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export const env = {
  /**
   * Read a key from a .env file. Returns null if not found.
   */
  read(envFile: string, key: string): string | null {
    if (!existsSync(envFile)) return null;

    const content = readFileSync(envFile, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;

      const eqIndex = trimmed.indexOf('=');
      const k = trimmed.slice(0, eqIndex).trim();

      if (k === key) {
        let value = trimmed.slice(eqIndex + 1).trim();
        // Remove surrounding quotes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return value;
      }
    }

    return null;
  },

  /**
   * Write/update a key in a .env file. Preserves comments and other keys.
   */
  write(envFile: string, key: string, value: string): void {
    if (!existsSync(envFile)) {
      writeFileSync(envFile, `${key}="${value}"\n`);
      return;
    }

    const content = readFileSync(envFile, 'utf-8');
    const lines = content.split('\n');
    let found = false;

    const updated = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) return line;

      const eqIndex = trimmed.indexOf('=');
      const k = trimmed.slice(0, eqIndex).trim();

      if (k === key) {
        found = true;
        // Preserve original quoting style
        const originalValue = trimmed.slice(eqIndex + 1).trim();
        if (originalValue.startsWith('"')) {
          return `${key}="${value}"`;
        } else if (originalValue.startsWith("'")) {
          return `${key}='${value}'`;
        }
        return `${key}=${value}`;
      }

      return line;
    });

    if (!found) {
      updated.push(`${key}="${value}"`);
    }

    writeFileSync(envFile, updated.join('\n'));
  },

  /**
   * Find the first .env file in a directory.
   */
  findEnvFile(root: string): string | null {
    const candidates = [
      '.env',
      '.env.local',
      '.env.development',
      '.env.development.local',
    ];
    for (const name of candidates) {
      const p = join(root, name);
      if (existsSync(p)) return p;
    }
    return null;
  },
};
