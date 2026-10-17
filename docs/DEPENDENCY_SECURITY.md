# Dependency security

CI runs `npm audit` for production and all dependencies on every pull request,
push to `main`, manual run and weekly schedule. High and critical advisories in
production dependencies fail CI. For the full dependency tree only critical
advisories fail CI; high advisories remain visible in the job output and must be
reviewed before production deployment.

As of 2026-10-17, npm reports:

- 0 advisories at high or critical in production dependencies
  (Next.js 16.4.2, Sharp 0.35.5; 2 moderate in `fast-uri` via Prisma tooling)
- 0 critical advisories in total
- high advisories only in development tooling, with no patched release yet:
  - `braces` through `micromatch` / `fast-glob` in `@next/eslint-plugin-next`
  - `node-forge` through `sonarqube-scanner`

These packages are not included in the production image. Malformed untrusted
glob patterns must not be passed to lint commands, and the SonarQube scanner is
only run against the local SonarQube server. Recheck when patched releases
appear and remove the exception from CI at that point.

`brace-expansion` and `fast-uri` are pinned in `overrides` to their patched
releases. Do not accept `npm audit fix --force` suggestions that downgrade
`eslint-config-next` or `sonarqube-scanner`.

Dependabot checks npm packages weekly and GitHub Actions monthly. Merge its
pull requests only after lint, type checking, tests, application build and
Docker build pass.
