<p align="center">
  <h1 align="center">branchdb</h1>
  <p align="center">Every git branch gets its own database. Auto-switch on checkout.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/branchdb"><img src="https://img.shields.io/npm/v/branchdb.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/branchdb"><img src="https://img.shields.io/npm/dm/branchdb.svg" alt="npm downloads"></a>
  <a href="https://github.com/ArslanYM/branchdb/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/branchdb.svg" alt="license"></a>
</p>

---

**Stop corrupting your local database every time you switch branches.**

You're on `feature/auth`, you run migrations, your database has new tables. You switch to `main` — your app crashes because those tables don't exist. You switch to `fix/payment` — now you have leftover data from `feature/auth` polluting your queries.

**branchdb gives every git branch its own isolated database.** Switch branches, and your `DATABASE_URL` updates automatically. Zero config after init. Works with any ORM.

## The Problem

```
# You're on feature/auth, added users_v2 table
git checkout main
# App crashes — users_v2 doesn't exist on main

git checkout fix/payment
# Leftover auth data corrupts your payment tests

git checkout feature/auth
# Someone else's migration broke your schema
```

Every developer has lost hours to this. Every team has a "just re-seed the database" ritual.

## The Fix

```bash
npx branchdb init
git checkout -b feature/auth   # DATABASE_URL auto-switches + DB auto-created
git checkout main              # back to main's clean database
git checkout fix/payment       # isolated database, zero conflicts
```

## Quick Start

```bash
# In your project directory (must have .env with DATABASE_URL)
npx branchdb init

# Create a database for your current branch
npx branchdb clone

# That's it. Switch branches and it just works.
# New branches get their own database automatically.
```

### Zero-friction mode (recommended)

```bash
# Enable auto-migration — never think about it again
npx branchdb init --auto-migrate

# Now on every branch switch:
# 1. DATABASE_URL updates automatically
# 2. If no DB exists, one is cloned from base
# 3. Pending migrations run automatically
```

## How It Works

1. **`branchdb init`** — Detects your database (PostgreSQL/MySQL/SQLite), reads `DATABASE_URL` from `.env`, installs a git hook
2. **`git checkout <branch>`** — The post-checkout hook fires, updates `DATABASE_URL` in `.env` to point to that branch's database. If no database exists for the branch, one is auto-created from the base branch.
3. **`branchdb clone`** — Manually creates a copy of the base database for the current branch
   - **PostgreSQL**: Uses `CREATE DATABASE ... TEMPLATE` (instant, filesystem-level copy)
   - **MySQL**: Uses `mysqldump | mysql` (fast logical copy)
   - **SQLite**: Copies the `.db` file (instant)

```
main          →  myapp                           (your original DB)
feature/auth  →  myapp_branchdb_feature_auth     (auto-created on checkout)
fix/payment   →  myapp_branchdb_fix_payment      (auto-created on checkout)
```

No reverse SQL. No migration tracking. No magic. Just one database per branch.

## Commands

| Command | Description |
|---------|-------------|
| `branchdb init` | Initialize branchdb in your project |
| `branchdb uninit` | Remove branchdb from your project |
| `branchdb clone` | Clone database for current branch |
| `branchdb reset` | Drop and re-clone database from base |
| `branchdb switch` | Switch DATABASE_URL (runs automatically via git hook) |
| `branchdb list` | List all branch databases (with sizes and ages) |
| `branchdb status` | Show current state and sync status |
| `branchdb clean` | Drop a branch's database |
| `branchdb diff` | Compare schema between branches |
| `branchdb migrate` | Auto-detect ORM and run migrations |
| `branchdb snapshot` | Save/restore named database snapshots |
| `branchdb doctor` | Run diagnostics and health checks |
| `branchdb protect` | Protect a branch database from being cleaned |
| `branchdb prompt` | Output DB name for shell prompt (PS1) integration |
| `branchdb url` | Print DATABASE_URL for current branch (for piping) |

## Options

```bash
# Init
branchdb init                   # Standard setup
branchdb init --auto-migrate    # Enable auto-migration on checkout
branchdb init --no-hook         # Skip git hook installation

# Re-run init to update settings
branchdb init --auto-migrate    # Toggle auto-migrate on existing project

# Uninit
branchdb uninit --force                   # Remove branchdb from project
branchdb uninit --force --drop-databases  # Also drop all branch databases

# Clone
branchdb clone                  # Clone from base branch
branchdb clone -f staging       # Clone from specific branch (--from)
branchdb clone -t my-branch     # Clone to specific branch (--to)
branchdb clone -m               # Clone + run ORM migrations (--migrate)

# Reset
branchdb reset                  # Re-clone from base branch
branchdb reset -f staging       # Re-clone from specific branch (--from)
branchdb reset -m               # Reset + run ORM migrations (--migrate)
branchdb reset --force          # Allow resetting the base branch

# Switch (runs automatically on git checkout — rarely needed manually)
branchdb switch                 # Switch to current branch's DB
branchdb switch -b feature/x   # Switch to specific branch DB

# Clean
branchdb clean                  # Drop current branch's DB
branchdb clean feature/old      # Drop specific branch DB
branchdb clean -a               # Drop ALL non-base branch databases (--all)
branchdb clean -s               # Show databases for deleted git branches (--stale)
branchdb clean -s --force       # Drop databases for deleted git branches
branchdb clean --force          # Override protection checks

# Snapshot
branchdb snapshot -n before-migration      # Save a snapshot (--name)
branchdb snapshot -l                       # List all snapshots (--list)
branchdb snapshot -r before-migration      # Restore a snapshot (--restore)
branchdb snapshot -d before-migration      # Delete a snapshot (--delete)

# List / Status
branchdb list                   # List all branch databases
branchdb list --json            # JSON output for scripting
branchdb status                 # Show current state
branchdb status --json          # JSON output for scripting

# Diff
branchdb diff                   # Compare current branch vs base
branchdb diff --branch staging  # Compare against specific branch

# Migrate
branchdb migrate                # Auto-detect ORM, run migrations
branchdb migrate -c "npx prisma migrate dev"  # Custom command (--command)

# Protect
branchdb protect                # Protect current branch
branchdb protect staging        # Protect specific branch
branchdb protect -r staging     # Remove protection (--remove)
branchdb protect -l             # List all protected branches (--list)

# URL (for piping — falls back to base branch if no DB registered)
branchdb url                    # Print DATABASE_URL for current branch
psql $(branchdb url)            # Connect directly

# Prompt (shell PS1 integration)
branchdb prompt                 # Outputs [db:feature_auth] or nothing
```

## Auto-Migration

branchdb can automatically run your ORM's migration command after every branch switch.

```bash
# Enable
branchdb init --auto-migrate

# What happens on `git checkout feature/auth`:
# 1. DATABASE_URL switches to feature/auth's database
# 2. If no DB exists, it's auto-cloned from base
# 3. `npx prisma migrate deploy` (or your ORM's equivalent) runs automatically
```

Auto-migrate uses **non-interactive** migration commands — they apply existing migration files without prompting:

| ORM | Manual (`branchdb migrate`) | Auto (hook / `--migrate`) |
|-----|---------------------------|--------------------------|
| Prisma | `npx prisma migrate dev` | `npx prisma migrate deploy` |
| Drizzle | `npx drizzle-kit push` | `npx drizzle-kit migrate` |
| TypeORM | `npx typeorm migration:run` | same |
| Sequelize | `npx sequelize-cli db:migrate` | same |
| Knex | `npx knex migrate:latest` | same |

You can also run migrations on-demand with `--migrate`:

```bash
branchdb clone --migrate   # Clone DB then run migrations
branchdb reset --migrate   # Reset DB then run migrations
```

## Snapshots

Save a point-in-time snapshot before running a destructive migration. Restore it if things go wrong.

```bash
# Save before a risky migration
branchdb snapshot --name before-migration

# Run your migration
npx prisma migrate dev

# Something went wrong? Restore the snapshot
branchdb snapshot --restore before-migration

# Manage snapshots
branchdb snapshot --list
branchdb snapshot --delete before-migration
```

## Shell Prompt Integration

See which database you're using right in your terminal prompt:

```bash
# Add to ~/.bashrc or ~/.zshrc:
export PS1='$(branchdb prompt 2>/dev/null) '$PS1
```

Result:
```
[db:feature_auth] ~/my-project $    # on a feature branch
~/my-project $                       # on base branch (silent)
```

Fast — reads only config + git, no database connection.

## Diagnostics

`branchdb doctor` runs 10 health checks to diagnose problems:

```bash
branchdb doctor
#  ✓ Git repository
#  ✓ branchdb config
#  ✓ .env file
#  ✓ DATABASE_URL
#  ✓ Branch database
#  ✓ Env sync          — DATABASE_URL matches branch config
#  ✓ Git hook          — post-checkout hook installed
#  ✓ DB connection     — database is reachable
#  ✓ .gitignore        — .branchdb is gitignored
#  ✓ sqlite3 CLI       — (SQLite only) needed for branchdb diff
```

## Stale Database Cleanup

Over time, you accumulate databases for branches you've already deleted. Clean them up:

```bash
branchdb clean --stale
# Found 3 stale branch database(s):
#   feature/old-auth → myapp_branchdb_feature_old_auth
#   fix/typo → myapp_branchdb_fix_typo
#   experiment/redis → myapp_branchdb_experiment_redis
#
# Run with --force to drop these databases.

branchdb clean --stale --force
# Cleaned 3 stale branch database(s).
```

## Supported Databases

| Database | Method | Speed |
|----------|--------|-------|
| **PostgreSQL** | `CREATE DATABASE ... TEMPLATE` | ~100ms for 100MB |
| **MySQL/MariaDB** | `mysqldump \| mysql` | ~1s for 100MB |
| **SQLite** | File copy | ~10ms for 100MB |

### Database driver setup

```bash
# PostgreSQL (optional dependency)
npm install pg

# MySQL/MariaDB (optional dependency)
npm install mysql2

# SQLite — no extra dependency needed
```

## Works With Any ORM

branchdb doesn't care about your ORM. It just changes `DATABASE_URL` in your `.env` file.

- Prisma
- Drizzle
- TypeORM
- Sequelize
- Knex
- Raw SQL
- Any framework that reads `DATABASE_URL`

## What Gets Created

```
your-project/
├── .branchdb/
│   ├── config.json          # Branch → database mapping + settings
│   └── snapshots/           # SQLite snapshots (if using SQLite)
├── .env                     # DATABASE_URL gets auto-updated
└── .git/hooks/post-checkout # Auto-switch hook
```

The `.branchdb/` directory is automatically added to `.gitignore`.

## FAQ

### Does this work with migrations?

Yes. Each branch has its own database, so migrations on `feature/auth` don't affect `main`. Enable `--auto-migrate` to have migrations run automatically on branch switch.

### What happens when I merge?

When you merge `feature/auth` into `main`, the migration files get merged. Run your ORM's migrate command on `main` to apply them. If you have `--auto-migrate` enabled, this happens automatically.

### Does this solve ORM migration file conflicts?

No. If two branches create migration files with the same name or conflicting timestamps, that's an ORM-level problem. branchdb solves **database state isolation** — each branch gets its own database so schema changes don't collide at runtime. Migration file conflicts need to be resolved at the git/ORM level.

### Does this work in CI/CD?

branchdb is for **local development only**. In CI, you typically spin up fresh databases anyway.

### What about disk space?

PostgreSQL `TEMPLATE` uses copy-on-write on supported filesystems, so cloned databases start with near-zero extra space. SQLite snapshots are full copies but typically small for dev databases. Use `branchdb list` to see database sizes, and `branchdb clean --stale` to clean up old branches.

### Can I use this with Docker?

Yes, as long as your app connects via `DATABASE_URL` in `.env`, branchdb works regardless of where PostgreSQL/MySQL/SQLite is running.

### How is this different from Neon/Supabase branching?

Neon and Supabase offer cloud database branching. branchdb is for **local development** — it works with your local PostgreSQL/MySQL/SQLite, requires no cloud service, and is completely free. If you're already using Neon branching in production, branchdb still makes sense for local dev where you don't want to hit cloud APIs on every `git checkout`.

## Contributing

```bash
git clone https://github.com/Yab8702/branchdb.git
cd branchdb
npm install
npm run build
npm run typecheck
npm test
node dist/index.js --help
```

### Running database-specific tests

```bash
# SQLite tests run automatically
npm test

# PostgreSQL tests (requires local PostgreSQL)
PG_TEST_URL="postgresql://postgres:postgres@localhost:5432/branchdb_test" npm test

# MySQL tests (requires local MySQL)
MYSQL_TEST_URL="mysql://root@localhost:3306/branchdb_test" npm test
```

## License
[MIT](LICENSE) - Built with ❤️ by the branchdb contributors. 
