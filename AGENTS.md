# Project Instructions

## Project overview

Build a production-ready corporate website and content management system for
บริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด, a Thai HVAC and M&E services company.

The system has two surfaces:

- A public Thai-language website for company information, services, products,
  projects, news, and contact information.
- A protected CMS for Editor and Super Admin users.

The target handoff date is 1 November 2026. The required deliverables are the
source code, database schema and migrations, administrator manual, environment
example, and local/production installation documentation. The company will
manage its own domain, hosting, production credentials, and final deployment.

## Source of truth

- Follow approved requirements and the supplied Figma reference images.
- Use the green visual identity from the Figma design.
- When requirements and mockups disagree, do not silently invent behavior.
  Preserve data integrity and security, document the discrepancy, and ask for
  clarification only when it blocks a safe implementation.
- Temporary Thai copy and placeholder media may be used during development.
  The company owner must verify all real company, product, pricing, and project
  information before publication.

## Technology stack

- Next.js with the App Router
- React
- TypeScript with strict mode
- Tailwind CSS
- PostgreSQL
- Prisma ORM and Prisma migrations
- Zod for server-side validation
- Secure database-backed sessions using HttpOnly cookies
- TOTP two-factor authentication compatible with authenticator applications
- S3-compatible object storage for images and PDF catalogs
- Docker and Docker Compose
- GitHub Actions
- Vitest for unit and integration tests
- Playwright for critical end-to-end workflows

Use stable, production-supported versions. Do not replace this stack unless the
user explicitly requests it.

## Product scope

### Public website

Provide these pages and capabilities:

- Home: banner, company introduction, featured services, featured products,
  recent projects, recent news, and contact calls to action.
- About: company history, vision, mission, company images, and key information.
- Services: service listing and detail pages for installation, cleaning,
  repair, maintenance, and other configured services.
- Products: product listing and detail pages with search and filters for name or
  model, brand, product type, and BTU range.
- Projects: project listing and detail pages with project type, area, date/year,
  description, related services, cover image, and gallery.
- News: listing and detail pages for company news, activities, knowledge
  articles, and promotions.
- Contact: address, business hours, phone, email, LINE, Facebook, Google Maps,
  and direct contact actions.
- Thai content only for the initial release.
- Responsive, accessible layouts matching the supplied Figma direction.
- Search-engine metadata, canonical URLs, sitemap, robots rules, and structured
  data where appropriate.

The initial release does not include customer accounts, ecommerce, ordering,
inventory, payments, appointment booking, quotation forms, contact-form message
storage, or a LINE bot. Do not add these features without explicit approval.

### CMS content

The CMS manages:

- Company profile and contact details
- Home-page banners
- Services
- Product brands, product types, and products
- Projects and project galleries
- News categories and news articles
- Media and PDF catalogs
- Administrator accounts and roles

Content should support explicit ordering, featured flags where applicable,
draft/published states, publication timestamps, SEO title and description, and
stable human-readable slugs. Published content may be created, updated,
published, unpublished, archived, or moved to trash by authorized users.

Products should support name, brand, model, product type, BTU, specifications,
features, optional warranty, optional SEER, optional refrigerant type, multiple
images, an optional PDF catalog, and a configurable inquiry-price label. Do not
implement public stock quantities or checkout behavior.

Projects should support title, project type, public area such as province,
description, completion date or year, related services, cover image, and image
gallery. Customer names are optional and must not be published unless the
company owner confirms that disclosure is permitted.

## Roles and authorization

Use deny-by-default server-side authorization for every CMS operation.

### Editor

- Sign in with username, password, and mandatory TOTP 2FA.
- Manage company information, banners, services, products, projects, news, and
  permitted media.
- Publish, unpublish, archive, restore, and move content to trash immediately.
- Update their own non-privileged profile fields and password.
- Cannot manage administrator accounts, roles, or global security settings.

### Super Admin

- Has all Editor permissions.
- Create, update, disable, and trash administrator accounts.
- Assign Editor or Super Admin roles.
- issue a temporary password reset for another administrator.
- Reset another administrator's 2FA after verifying the account owner.
- View system overview and audit history.

Prevent the last active Super Admin from being disabled, demoted, or deleted.
Prevent users from escalating their own privileges. Recheck role and account
status on the server for every protected operation.

## Authentication and 2FA

- There is no public registration.
- Administrators sign in using a unique username and password.
- Use a trusted, production-supported password hashing implementation with
  secure parameters. Never store or log plaintext passwords.
- Use opaque, revocable, database-backed sessions in HttpOnly, Secure,
  SameSite=Lax or stricter cookies in production.
- Rotate sessions after password changes, role changes, 2FA changes, and full
  authentication. Invalidate affected sessions after account disablement or a
  security reset.
- Apply rate limiting and progressive delays to password and TOTP attempts.
- Return generic authentication errors to reduce account enumeration.
- Require TOTP 2FA for every administrator account; it cannot be disabled for
  normal use.
- Complete TOTP enrollment on first sign-in before granting CMS access.
- Generate 8-10 single-use recovery codes, show them only at enrollment or
  regeneration, and store only secure hashes.
- Encrypt TOTP secrets at rest with a versioned server-side key supplied through
  environment variables. Never expose secrets after enrollment.
- A Super Admin reset must clear the old TOTP secret and recovery codes and
  require fresh enrollment at the next sign-in.
- Administrator password resets use a short-lived temporary password and force
  a password change on the next sign-in.
- Seed the first Super Admin through a documented, idempotent setup command that
  reads credentials from environment variables. Never commit initial
  credentials.
- Provide a documented server-only emergency recovery command. Require direct
  server and database access, invalidate existing sessions, and write an audit
  event.

## Trash and retention

- Use soft deletion for CMS content and administrator accounts where safe.
- Keep trashed records for 30 days before permanent deletion.
- Permit authorized restoration during the retention period.
- Only Super Admin may permanently delete before the retention period ends.
- Run expiry cleanup through an explicit, idempotent scheduled job or command.
- Do not automatically hard-delete records if referenced files or relational
  records cannot be safely handled in the same operation.
- Keep security and administrative audit events for at least 180 days.

## Dashboard and audit

The initial dashboard should show:

- Counts for services, products, projects, and news
- Draft and published counts
- Recently modified content
- Recent audit activity permitted for the current role
- Object-storage usage when the configured provider exposes reliable usage data

Do not add visitor analytics to the first release.

Record structured audit events for successful and failed authentication,
logout, session revocation, password and 2FA resets, account and role changes,
publishing, unpublishing, trashing, restoration, permanent deletion, and other
critical CMS changes. Include timestamp, actor ID, action, target type and ID,
result, request ID, IP address, and user agent where appropriate. Do not store
passwords, session values, TOTP secrets, recovery codes, object-storage
credentials, or unnecessary personal data in logs.

## Architecture

- Prefer Server Components by default.
- Use Client Components only for interactions, browser APIs, or client state
  that genuinely requires them.
- Keep authentication, authorization, database access, file signing, and
  sensitive logic on the server.
- Separate routing/UI, schemas, authentication, authorization, business logic,
  repositories, storage adapters, scheduled jobs, and infrastructure concerns.
- Keep business logic outside React components, Server Actions, and route
  handlers.
- Access PostgreSQL through dedicated repository or service modules.
- Wrap the S3 API behind a storage interface so providers can be changed without
  rewriting domain logic.
- Use transactions for operations that must succeed or fail together.
- Avoid N+1 queries, select only required fields, and paginate large listings.
- Cache public data only when invalidation is explicit. Never publicly cache
  user-specific CMS or authentication responses.

## Database requirements

- Use Prisma migrations for every schema change.
- Use primary keys, foreign keys, unique constraints, not-null constraints,
  check constraints where Prisma/PostgreSQL support them safely, and indexes for
  frequent filters, sorts, joins, slugs, statuses, and retention jobs.
- Use case-normalized uniqueness for usernames and public slugs.
- Model publication, archival, soft deletion, and audit timestamps explicitly.
- Protect referential integrity for media, galleries, categories, and related
  services.
- Use development seed data only; label it clearly and never seed real
  credentials or private company data.
- Never run destructive production migrations automatically.
- Document backup, restore, migration, and rollback procedures.

## Validation and API security

- Validate all external input on the server using Zod, including bodies, route
  and query parameters, cookies, headers, environment variables, upload
  metadata, and scheduled-job inputs.
- Reject unknown fields where appropriate and explicitly select writable fields
  to prevent mass assignment.
- Use allowlists for status transitions, filtering, and sorting.
- Use correct HTTP methods and status codes with consistent, non-sensitive error
  responses.
- Enforce content-type and request-size limits.
- Protect state-changing requests against CSRF using secure SameSite cookies,
  origin validation, and additional tokens when required by the chosen action
  transport.
- Prevent SQL injection, XSS, insecure direct object references, open redirects,
  path traversal, SSRF, prototype pollution, and unsafe deserialization.
- Do not use `dangerouslySetInnerHTML` unless a requirement truly needs rich
  HTML; sanitize it server-side and apply a restrictive policy before rendering.

## File uploads and object storage

- Store uploads in configured S3-compatible object storage, not in the
  application container filesystem.
- Accept JPEG, PNG, and WebP images up to 10 MB each and PDF catalogs up to
  20 MB each for the initial release.
- Validate extension, declared MIME type, actual file signature, file size, and
  file count. Never trust browser-provided filenames or MIME types.
- Generate random storage keys and safe derivatives. Never execute uploads.
- Normalize image orientation, remove unnecessary metadata, optimize images,
  generate responsive thumbnails, and output WebP or AVIF where supported.
- Keep original files only when there is a documented content need.
- Store private or unpublished media privately and serve it through authorized,
  short-lived signed URLs.
- Verify authorization before upload, replacement, download, association, or
  deletion.
- Prevent orphaned objects through transactional metadata and retryable cleanup
  jobs. Do not delete shared objects while they are still referenced.
- Add malware scanning when the selected hosting environment supports it; note
  this limitation if it is not available.

## UI and accessibility

- Follow the supplied green Figma visual direction and maintain consistent
  design tokens for colors, spacing, typography, radii, borders, and shadows.
- Use semantic HTML, visible focus states, keyboard navigation, descriptive
  labels, useful alternative text, and sufficient color contrast.
- Support mobile, tablet, and desktop layouts.
- Include loading, empty, success, error, confirmation, and disabled states.
- Prevent duplicate submissions and make destructive actions explicit.
- Require confirmation for permanent deletion and other irreversible actions.
- Keep Thai text readable and avoid layouts that assume short English labels.

## SEO and public content

- Generate metadata per page from CMS data with safe defaults.
- Generate canonical URLs, XML sitemap, robots configuration, Open Graph data,
  and relevant Organization/LocalBusiness structured data.
- Exclude drafts, archived content, trash, CMS pages, authentication routes, and
  private media from search indexing.
- Keep slugs stable; implement validated redirects if a published slug changes.
- Do not publish unverified customer names, personal information, exact private
  job-site details, or sensitive business information.

## Security headers and errors

- Configure a restrictive Content-Security-Policy compatible with required
  assets and maps.
- Set HSTS in production, X-Content-Type-Options, frame-ancestors or
  X-Frame-Options, Referrer-Policy, and an appropriate Permissions-Policy.
- Enforce HTTPS in production and disable unnecessary framework/version headers.
- Use centralized typed application errors and structured logging.
- Return generic user-facing errors and never expose stack traces, database
  errors, internal paths, secrets, or raw third-party errors.
- Use request/correlation IDs for troubleshooting.

## Testing

- Add unit tests for business rules, validation, content state transitions,
  retention calculations, and permission checks.
- Add integration tests for database behavior, migrations, repositories, APIs,
  authentication, sessions, TOTP, recovery codes, RBAC, audit events, and file
  metadata.
- Test Editor and Super Admin permissions, privilege escalation attempts, the
  last-Super-Admin safeguard, and unauthorized record access.
- Test malformed input, rate limiting, CSRF protections, upload restrictions,
  soft deletion, restoration, and retention cleanup.
- Add Playwright tests for public browsing/search and critical CMS workflows:
  first-time 2FA enrollment, sign-in, content creation and publication, trash
  and restore, administrator creation, and forced password reset.
- Use a separate test database and isolated test object-storage configuration.
- Never run destructive tests against production data or storage.

## DevOps and operations

- Provide a production-ready multi-stage Dockerfile and run as a non-root user
  where practical.
- Provide Docker Compose for local application and PostgreSQL development.
- Do not copy secrets into images or commit real `.env` files.
- Provide a documented `.env.example` covering database, session, TOTP
  encryption, object storage, application URL, and bootstrap settings.
- Include application and dependency health checks without exposing sensitive
  details.
- Configure GitHub Actions for formatting/linting, type checking, unit and
  integration tests, production build, migration validation, and critical E2E
  tests where the runner environment permits.
- Keep development, test, staging, and production configuration separate.
- Apply explicit timeouts and safe retry policies to external storage calls.
- Document installation, first-Super-Admin bootstrap, 2FA enrollment, emergency
  recovery, backup/restore, migration, rollback, scheduled cleanup, and object
  storage configuration in the handoff material.
- Do not deploy, purchase a domain, create production infrastructure, or perform
  destructive database/storage operations without explicit user approval.

## Administrator manual requirements

The Thai administrator manual must cover:

- Initial sign-in and mandatory 2FA enrollment
- Recovery-code storage and use
- Password changes and temporary-password resets
- Managing company information and banners
- Creating, editing, publishing, unpublishing, and trashing each content type
- Uploading and replacing images and PDF catalogs
- Restoring content and permanently deleting content
- Managing administrators and roles as Super Admin
- Reading the dashboard and audit history
- Emergency account recovery and operational limitations

## Completion checklist

Before reporting completion:

- Verify the production build succeeds.
- Run TypeScript type checking, linting, formatting checks, relevant tests, and
  migration validation.
- Check that no secrets, credentials, private company records, or sensitive
  uploads are committed or exposed.
- Review authentication, session, TOTP, recovery-code, RBAC, upload, trash,
  retention, and audit paths.
- Check database constraints and indexes.
- Confirm public pages include accessible loading, empty, error, and responsive
  states.
- Confirm drafts, archived records, trash, CMS routes, and private media cannot
  leak through public APIs, caching, metadata, or search indexing.
- Summarize changed files, commands run, test results, assumptions, and remaining
  risks or limitations.
- Never claim the system is fully secure.
- Never make destructive database, storage, infrastructure, or production
  changes without explicit confirmation.
