# Dependency security

CI runs `npm audit` for production and all dependencies on every pull request,
push to `main`, manual run and weekly schedule. Critical advisories fail CI.
High advisories remain visible in the job output and must be reviewed before
production deployment.

As of 2026-07-28, npm reports:

- 0 critical advisories
- 11 high advisories in total
- 2 high advisories in production dependencies

The production advisory is inherited through Next.js 15.5.22:
`next -> sharp 0.34.5 -> libvips`. The patched Sharp line starts at 0.35, while
the current Next.js 15 and 16 releases declare `sharp ^0.34.x`. Do not force an
override or accept npm's suggested Next.js downgrade automatically. Recheck
after a compatible Next.js release and upgrade through a tested pull request.

The remaining advisories are in the ESLint toolchain through older `minimatch`
and `brace-expansion` versions. They are development-only and are not included
in the production image, but malformed untrusted glob patterns must not be
passed to lint commands.

Dependabot checks npm packages weekly and GitHub Actions monthly. Merge its
pull requests only after lint, type checking, tests, application build and
Docker build pass.
