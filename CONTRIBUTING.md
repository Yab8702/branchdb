# Contributing to branchdb

Thank you for considering contributing to branchdb! Every contribution helps make database branching better for developers everywhere.

## Philosophy

branchdb is built on 3 principles:

1. **Zero friction** — Works out of the box with any ORM. No schema tracking, no reverse SQL, just isolated databases per branch.
2. **Git-native** — Hooks into `git checkout` so switching branches is all you need. No extra commands to remember.
3. **Driver-faithful** — Each database driver uses its own native copy mechanism (PostgreSQL template databases, MySQL dump/restore, SQLite file copy) for speed and correctness.

## Project Structure

```
branchdb/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── commands/          # One file per branchdb command
│   ├── core/              # Config, git integration, env handling, driver factory
│   ├── drivers/           # PostgreSQL, MySQL, SQLite drivers
│   └── utils/             # Logging, helpers
└── tests/
    ├── commands/          # Command-level tests
    ├── core/              # Core module tests
    ├── integration/       # Database integration tests
    └── utils/             # Utility tests
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9 (bundled with Node.js)

### Setup

```bash
# 1. Fork and clone
git clone https://github.com/Yab8702/branchdb.git
cd branchdb

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Run tests
npm test
```

### Development Workflow

```bash
# Watch mode (rebuilds on change)
npm run dev

# Type check
npm run typecheck

# Run tests
npm test
npm run test:watch
```

## Contributing Workflow

1. **Create a branch** from `master`:
   ```bash
   git checkout -b type/description
   ```

   Branch prefixes:
   | Prefix | Purpose |
   |--------|---------|
   | `feat/` | New features |
   | `fix/` | Bug fixes |
   | `docs/` | Documentation |
   | `driver/` | New database driver |
   | `refactor/` | Code restructuring |
   | `test/` | Tests |
   | `chore/` | Maintenance |

2. **Make changes** — keep PRs focused and small

3. **Test thoroughly**:
   ```bash
   npm test
   npm run build
   npm run typecheck
   ```

4. **Commit** with [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add CockroachDB driver"
   git commit -m "fix: post-checkout hook not firing on Windows"
   git commit -m "docs: add shell prompt integration example"
   ```

5. **Open a PR** against `master`

## Where to Contribute

### Good First Issues

- Improve error messages in `branchdb doctor`
- Add more ORM detection patterns in the detector
- Add examples for different ORM configurations in the README
- Improve `branchdb list` output formatting

### Adding a New Database Driver

Drivers live in `src/drivers/`. Each driver implements the `DatabaseDriver` interface from `src/drivers/types.ts`:

```typescript
// src/drivers/mydriver.ts
import type { DatabaseDriver } from "./types.js";

export class MyDriver implements DatabaseDriver {
  async clone(source: string, target: string): Promise<void> {
    // Copy source DB to target DB
  }

  async drop(dbName: string): Promise<void> {
    // Drop the database
  }

  async exists(dbName: string): Promise<boolean> {
    // Check if database exists
  }

  // ... other required methods
}
```

Then register it in `src/core/driver-factory.ts`.

## Code Quality

- All code must be TypeScript with strict mode
- Use meaningful names — avoid abbreviations
- Functions should do one thing
- Handle errors explicitly — no silent failures
- Write tests for new features and bug fixes
- Keep driver APIs consistent

## Testing

```bash
# All tests
npm test

# Watch mode
npm run test:watch
```

Integration tests in `tests/integration/` require a live database connection. Set `DATABASE_URL` in your environment to run them.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
