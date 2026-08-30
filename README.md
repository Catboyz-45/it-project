# อยู่เย็นเป็นสุข วิศวกรรม — Website & CMS

UX/UI implementation for the company website and protected content management
system. The current milestone includes PostgreSQL-backed authentication,
mandatory TOTP, secure sessions, RBAC, and administrator account management.
Content mutations, S3-compatible media uploads, Published public queries,
server-side search and pagination, signed catalog delivery, tagged caching,
dynamic SEO data, and old-slug redirects are connected. Production still
requires a private bucket and provider-specific CORS configuration.

## Run locally

```bash
npm install
npm run dev
```

Configure the required environment values and database first, then open
`http://localhost:3000`. `/admin` redirects unauthenticated users to `/login`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=high
```

## Database foundation

The PostgreSQL/Prisma schema, reviewed initial migration, repository/service
layers, environment validation, and an idempotent development seed are available.
See [docs/DATABASE.md](docs/DATABASE.md) before creating or migrating a database.

เอกสารส่งมอบ: [คู่มือ Deployment](docs/DEPLOYMENT.md),
[คู่มือผู้ดูแลภาษาไทย](docs/ADMIN-MANUAL-TH.md) และ
[แผนนำเข้าข้อมูล/UAT](docs/DATA-MIGRATION-AND-UAT.md)

เอกสารสำหรับผู้ที่ไม่มีพื้นฐานโค้ด:

- [ภาพรวมโปรเจกต์ภาษาไทย](docs/PROJECT-GUIDE-TH.md)
- [รายการ API ทั้งหมด](docs/API-REFERENCE-TH.md)
- [คำอธิบายฐานข้อมูล 21 ตาราง](docs/DATABASE-GUIDE-TH.md)
- [วิธีอ่านโค้ดและคอมเมนต์](docs/CODE-READING-GUIDE-TH.md)

```bash
npm run db:generate
npm run db:validate
npm run db:migrate:dev
npm run db:seed
```

## Implemented routes

- Public: home, about, services, service detail, products, product detail,
  projects, project detail, news, article detail, contact, and mobile menu.
- Public collections read only currently published, non-trashed records.
  Products support database search plus brand, type, and BTU filters; products,
  projects, and news use URL-based server pagination. Public cover/gallery media
  and PDF catalogs use short-lived signed object-storage URLs. CMS mutations
  explicitly invalidate tagged public caches.
- Authentication UX: username/password sign-in, invalid/locked states,
  first-login password change, TOTP enrollment and verification, one-time
  recovery-code handoff, recovery-code sign-in, and session-expired handling.
- CMS: dashboard, company information, banners, services, products, projects,
  news, administrators, audit history, and 30-day trash.

## Authentication setup

Generate independent random secrets outside source control. `SESSION_SECRET`
must contain at least 32 characters and `TOTP_ENCRYPTION_KEY` must be a Base64
encoded 32-byte key. Apply the reviewed migrations, then create the first Super
Admin with a temporary password:

```bash
cp .env.example .env
openssl rand -base64 48
openssl rand -base64 32
npm run db:generate
npx prisma migrate deploy
BOOTSTRAP_ADMIN_USERNAME=owner BOOTSTRAP_ADMIN_PASSWORD='temporary-secret' npm run auth:bootstrap
```

The first login forces a password change and TOTP enrollment. Recovery codes are
shown once. For a verified emergency where all Super Admins have lost access,
run `npm run auth:recover -- <username>` on a trusted server; the command revokes
all sessions and requires fresh password and 2FA setup. Never run it as a routine
password-reset path.

## Isolated test configuration

Tests that write data never use the development `DATABASE_URL` directly. Create
an ignored `.env.test` and set `TEST_DATABASE_URL` to a separate database whose
name contains `test`, `e2e`, or `sandbox`:

```bash
cp .env.test.example .env.test
npm run db:test:migrate:deploy
npm run test:integration
```

The test runner validates the database URL and then exposes it to Prisma as
`DATABASE_URL`. It refuses to start when `TEST_DATABASE_URL` is missing or the
database name does not clearly identify an isolated test database. Do not copy
production credentials into `.env.test`.

## CMS retention job

CMS records use soft deletion and remain restorable for 30 days. Schedule this
idempotent commands once per day from a trusted worker after configuring
`DATABASE_URL`:

```bash
npm run cms:purge-expired
npm run auth:cleanup
```

The CMS command permanently removes only expired records whose required
references can be deleted safely. The authentication command retains inactive
sessions for 30 days and expired throttle records for 7 days by default; both
values are configurable. Each command writes a system audit event. Back up the
production database and test restore procedures before enabling the schedule.

## Media storage

Signed direct uploads, image/PDF validation, WebP/AVIF derivatives, private
delivery, usage reporting, and retryable orphan cleanup are implemented. See
[docs/MEDIA-STORAGE.md](docs/MEDIA-STORAGE.md), then schedule:

```bash
npm run media:cleanup
```

- Content editors: create/edit flows for banners, services, products, projects,
  and news with real media uploads, specifications, SEO preview, draft/publish
  controls, and public-page preview.
- Taxonomies: news categories, product brands, and product types.

## Content and security notes

- Company identity, address, phone, email, LINE, product specifications, customer
  names, and project details currently include placeholders. The company owner
  must verify them before publication.
- Authentication includes database-backed sessions, mandatory TOTP, RBAC,
  same-origin checks, server validation, audit persistence, and rate limiting.
  Production readiness still requires deployment-specific TLS, secret management,
  database backup/restore validation, monitoring, configured object storage, and end-to-end
  tests against the production-like environment.
- Never place real secrets in source control. Use `.env.example` as the list of
  required configuration values.

## Confirmed public contact data

Public contact actions read from `NEXT_PUBLIC_COMPANY_*` values documented in
`.env.example`. Until the company owner confirms a value, LINE, Facebook, the
office address, and Google Maps are deliberately shown as pending instead of
linking visitors to an invented destination. Restart the development server
after changing public environment values.

Product catalog downloads use approved PDFs from the configured private
S3-compatible storage. Products without an attached catalog return 404.
