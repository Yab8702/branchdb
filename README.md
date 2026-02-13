<p align="center">
  <h1 align="center">branchdb</h1>
  <p align="center">Every git branch gets its own database. Auto-switch on checkout.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/branchdb"><img src="https://img.shields.io/npm/v/branchdb.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/branchdb"><img src="https://img.shields.io/npm/dm/branchdb.svg" alt="npm downloads"></a>
  <a href="https://github.com/TODO/branchdb/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/branchdb.svg" alt="license"></a>
</p>

---

**Stop corrupting your local database every time you switch branches.**

You're on `feature/auth`, you run migrations, your database has new tables. You switch to `main` — your app crashes because those tables don't exist. You switch to `fix/payment` — now you have leftover data from `feature/auth` polluting your queries.

**branchdb gives every git branch its own isolated database.** Switch branches, and your `DATABASE_URL` updates automatically. Zero config. Works with any ORM.

## The Problem

```
# You're on feature/auth, added users_v2 table
git checkout main
# 💥 App crashes — users_v2 doesn't exist on main

git checkout fix/payment  
# 💥 Leftover auth data corrupts your payment tests

git checkout feature/auth
# 💥 Someone else's migration broke your schema
```

Every developer has lost hours to this. Every team has a "just re-seed the database" ritual.

## The Fix

```bash
npx branchdb init          # one-time setup (2 seconds)
git checkout feature/auth  # DATABASE_URL auto-switches ✓
git checkout main          # back to main's clean database ✓
git checkout fix/payment   # isolated database, zero conflicts ✓
```

## Quick Start

```bash
# In your project directory (must have .env with DATABASE_URL)
npx branchdb init

# Create a database for your current branch
npx branchdb clone

# That's it. Switch branches and it just works.
```

## How It Works

1. **`branchdb init`** — Detects your database (PostgreSQL/SQLite), reads `DATABASE_URL` from `.env`, installs a git hook
2. **`git checkout <branch>`** — The post-checkout hook fires, updates `DATABASE_URL` in `.env` to point to that branch's database
3. **`branchdb clone`** — Creates a copy of the base database for the current branch
   - **PostgreSQL**: Uses `CREATE DATABASE ... TEMPLATE` (instant, filesystem-level copy)
   - **SQLite**: Copies the `.db` file (instant)

```
main          →  myapp                    (your original DB)
feature/auth  →  myapp_branchdb_feature_auth  (cloned from main)
fix/payment   →  myapp_branchdb_fix_payment   (cloned from main)
```

No reverse SQL. No migration tracking. No magic. Just one database per branch.

## Commands

| Command | Description |
|---------|-------------|
| `branchdb init` | Initialize branchdb in your project |
| `branchdb clone` | Clone database for current branch |
| `branchdb switch` | Manually switch DATABASE_URL (auto on checkout) |
| `branchdb list` | List all branch databases |
| `branchdb status` | Show current state and sync status |
| `branchdb clean [branch]` | Drop a branch's database |
| `branchdb clean --all` | Drop ALL non-base branch databases |

## Options

```bash
branchdb init --no-hook       # Skip git hook installation
branchdb clone --from main    # Clone from specific branch
branchdb clone --to my-branch # Clone to specific branch
branchdb switch -b feature/x  # Switch to specific branch DB
```

## Supported Databases

| Database | Method | Speed |
|----------|--------|-------|
| **PostgreSQL** | `CREATE DATABASE ... TEMPLATE` | ~100ms for 100MB |
| **SQLite** | File copy | ~10ms for 100MB |

## Works With Any ORM

branchdb doesn't care about your ORM. It just changes `DATABASE_URL` in your `.env` file.

- ✅ Prisma
- ✅ Drizzle
- ✅ TypeORM
- ✅ Sequelize
- ✅ Knex
- ✅ Raw SQL
- ✅ Any framework that reads `DATABASE_URL`

## What Gets Created

```
your-project/
├── .branchdb/
│   ├── config.json          # Branch → database mapping
│   └── snapshots/           # SQLite snapshots (if using SQLite)
├── .env                     # DATABASE_URL gets auto-updated
└── .git/hooks/post-checkout # Auto-switch hook
```

## FAQ

### Does this work with migrations?

Yes. Run your migrations normally. Each branch has its own database, so migrations on `feature/auth` don't affect `main`.

### What happens when I merge?

When you merge `feature/auth` into `main`, the migration files get merged into `main`. Run `npx prisma migrate dev` (or your ORM's equivalent) on `main` to apply them.

### Does this work in CI/CD?

branchdb is for **local development only**. In CI, you typically spin up fresh databases anyway.

### What about disk space?

PostgreSQL `TEMPLATE` uses copy-on-write on supported filesystems, so cloned databases start with near-zero extra space. SQLite snapshots are full copies but typically small for dev databases.

### Can I use this with Docker?

Yes, as long as your app connects via `DATABASE_URL` in `.env`, branchdb works regardless of where PostgreSQL/SQLite is running.

## Contributing

```bash
git clone https://github.com/TODO/branchdb.git
cd branchdb
npm install
npm run build
node dist/index.js --help
```

## License

MIT
