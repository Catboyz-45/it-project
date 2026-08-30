# Database foundation

The application uses PostgreSQL through Prisma ORM. The initial migration is
stored in `prisma/migrations/20260801000100_initial_foundation` and includes
foreign keys, unique constraints, query indexes, retention checks, case-insensitive
slug/username indexes, positive numeric checks, and redirect safety checks.

## Local setup

1. Copy `.env.example` to `.env` and replace every development placeholder.
2. Create a dedicated local PostgreSQL database and least-privilege application
   role. Do not reuse a production role.
3. Generate the Prisma Client and apply migrations:

```bash
npm install
npm run db:generate
npm run db:migrate:dev
npm run db:seed
```

The seed is idempotent and contains development-only demonstration content. It
refuses to run when `NODE_ENV=production` unless an operator explicitly sets
`ALLOW_PRODUCTION_SEED=true`. Production content should be imported through a
reviewed, one-time data migration instead of the development seed.

The seed intentionally does not create an administrator. After migrations, use
`npm run auth:bootstrap` with `BOOTSTRAP_ADMIN_USERNAME` and a temporary
`BOOTSTRAP_ADMIN_PASSWORD`. The command hashes the password and never writes it
to source control. The user must replace it and enroll TOTP on first login.

## Isolated test database

Copy `.env.test.example` to the ignored `.env.test` file and configure a
dedicated PostgreSQL database. The database name must contain `test`, `e2e`, or
`sandbox`; otherwise the test runner fails closed.

```bash
cp .env.test.example .env.test
npm run db:test:migrate:deploy
npm run db:test:migrate:status
npm run test:integration
```

`TEST_DATABASE_URL` is authoritative for data-writing tests. The wrapper sets
`DATABASE_URL` only for the child process, so Prisma, Vitest, Playwright, and the
temporary Next.js test server all use the same isolated database. Keep `.env`
for local development and never point `.env.test` at staging or production.

## Schema changes

For each schema change:

```bash
npx prisma format
npm run db:validate
npx prisma migrate dev --name describe_the_change
npm run db:generate
```

Review generated SQL before committing it. Add PostgreSQL check constraints to
the migration when a business invariant cannot be expressed by Prisma. Never use
`prisma db push` as a replacement for reviewed production migrations.

## Production deployment

1. Back up the database and verify that the backup can be restored.
2. Test the migration against a recent sanitized staging copy.
3. Check pending migrations with `npx prisma migrate status`.
4. Apply reviewed migrations with `npx prisma migrate deploy` from a controlled
   release job using a migration role. The runtime role should not own the schema.
5. Run application smoke tests before directing traffic to the new release.

Do not run `migrate dev`, `db push`, the development seed, or destructive tests
against production.

## Backup and restore

Use the hosting provider's managed backups plus encrypted logical backups. A
typical logical backup workflow is:

```bash
pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL" --file=backup.dump
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" backup.dump
```

Always restore into a separate database first and validate row counts, foreign
keys, media references, and administrator/session state. Never test restore by
overwriting the active production database.

## Rollback

Prisma migrations are forward-only. Prefer a corrective migration. For a risky
release, use an expand/migrate/contract sequence so the previous application
version remains compatible. If a migration causes unrecoverable corruption:

1. Stop writes.
2. Preserve logs and the damaged database for investigation.
3. Restore the last verified backup into a new database.
4. Point the application to the restored database through the secret manager.
5. Reconcile any accepted writes after the backup using the audit trail.

Never delete or rewrite an already-applied migration file.

## Retention

Soft-deletable records use `deletedAt` and `purgeAt`. The migration enforces that
`purgeAt` cannot precede `deletedAt`. The future cleanup job must process small,
idempotent batches and must verify media references before deleting object-storage
files. Audit events are append-oriented and should be retained for at least 180
days.
