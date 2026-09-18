# Project Instructions

## Project goal

Build a production-ready, secure, maintainable full-stack web application.

## Technology stack

- Next.js
- React
- TypeScript with strict mode
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Zod for server-side validation
- Secure session-based authentication using HttpOnly cookies
- Docker and Docker Compose
- GitHub Actions
- Vitest for unit and integration tests
- Playwright for critical end-to-end workflows

Do not replace this stack unless explicitly requested.

## Engineering requirements

- Use stable, production-supported dependency versions.
- Follow clean code, modular architecture, separation of concerns, DRY, and least privilege.
- Keep business logic outside React components and route handlers.
- Keep database access in dedicated server-side modules or services.
- Use environment variables for configuration and secrets.
- Never hardcode credentials, tokens, API keys, or private data.
- Include a safe `.env.example` without real secrets.
- Avoid unnecessary dependencies.
- Preserve compatibility with the existing project structure and package versions.

## Next.js and React

- Prefer Server Components by default.
- Use Client Components only when browser APIs, client-side state, or user interaction require them.
- Keep authentication, authorization, database access, and sensitive logic on the server.
- Never trust client-side state for authorization decisions.
- Use semantic HTML and accessible components.
- Include loading, empty, success, error, and disabled states.
- Prevent duplicate form submissions.
- Do not use `dangerouslySetInnerHTML` unless absolutely necessary and sanitized.

## PostgreSQL and Prisma

- Use Prisma migrations for every database schema change.
- Use primary keys, foreign keys, unique constraints, not-null constraints, and indexes where appropriate.
- Use transactions for operations that must succeed or fail together.
- Avoid N+1 queries.
- Select only required database fields.
- Use pagination for large datasets.
- Prefer Prisma queries.
- When raw SQL is necessary, use parameterized queries only.
- Verify authorization and record ownership before reading or modifying data.
- Never run destructive migrations automatically against production.
- Include development seed data when useful.

## Validation

- Validate all external input on the server using Zod.
- Client-side validation is for user experience only.
- Validate request bodies, route parameters, query parameters, uploaded files, cookies, and environment variables.
- Reject unknown fields where appropriate.
- Use allowlists instead of blocklists.
- Enforce type, length, range, format, enum, and business-rule constraints.
- Prevent mass assignment by explicitly selecting accepted fields.

## Authentication and authorization

- Prefer secure server-side sessions using HttpOnly cookies.
- Set cookies with HttpOnly, Secure, and SameSite=Lax or Strict in production.
- Rotate sessions after login, password changes, and privilege changes.
- Use secure expiration and server-side session revocation.
- Hash passwords using a trusted production-supported implementation.
- Never store or log plaintext passwords.
- Implement login rate limiting and brute-force protection.
- Use generic authentication errors to reduce account enumeration.
- Use expiring, single-use verification and password-reset tokens.
- Implement RBAC or permission-based access control where appropriate.
- Check authorization on the server for every sensitive operation.
- Verify record ownership.
- Deny access by default.

## Security

- Prevent SQL injection through Prisma or parameterized SQL.
- Prevent XSS through React escaping and safe rendering.
- Protect state-changing requests against CSRF.
- Prevent insecure direct object references.
- Prevent open redirects, path traversal, SSRF, mass assignment, and unsafe file uploads.
- Apply restrictive security headers, including CSP, HSTS, nosniff, frame-ancestors, Referrer-Policy, and Permissions-Policy.
- Enforce HTTPS in production.
- Apply request size limits, rate limits, and external request timeouts.
- Do not expose stack traces, SQL errors, internal paths, secrets, or infrastructure details to users.
- Use generic user-facing errors and secure detailed logs.

## File uploads

- Validate actual MIME type, extension, size, and file count.
- Never trust filenames or MIME types supplied by the browser.
- Use an allowlist of permitted file types.
- Generate random server-side filenames.
- Store private files outside the public directory when possible.
- Prevent uploaded files from being executed.
- Verify authorization before upload, download, replacement, or deletion.

## Logging and audit

- Use structured logs.
- Log authentication events, authorization failures, administrative actions, and critical data changes.
- Include timestamps, user ID, action, result, request ID, IP address, and user agent where appropriate.
- Never log passwords, tokens, cookies, secrets, reset links, or unnecessary personal data.
- Use centralized error handling.
- Protect audit logs from unauthorized modification.

## Testing

- Add unit tests for business logic.
- Add integration tests for database and API behavior.
- Test authentication, session handling, authorization, RBAC, and record ownership.
- Test validation failures and malformed input.
- Test CSRF protection and file-upload restrictions where applicable.
- Add Playwright tests for critical user workflows.
- Use a separate test database.
- Never run destructive tests against production data.

## DevOps

- Provide a production-ready Dockerfile.
- Use multi-stage builds where appropriate.
- Run containers as a non-root user where possible.
- Do not copy secrets into container images.
- Include health checks.
- Provide Docker Compose for local development.
- Configure GitHub Actions for linting, type checking, testing, building, and migration validation.
- Fail CI when required checks fail.
- Keep development, testing, staging, and production configurations separate.
- Document database backup, restore, migration, and rollback procedures.

## Completion checklist

Before reporting completion:

- Verify the project builds successfully.
- Run TypeScript type checking.
- Run linting.
- Run relevant automated tests.
- Check that no secrets are committed or exposed.
- Check authentication and authorization paths.
- Check database migrations and constraints.
- Summarize changed files, commands run, test results, assumptions, and remaining limitations.
- Do not make destructive database, infrastructure, or production changes without explicit confirmation.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
