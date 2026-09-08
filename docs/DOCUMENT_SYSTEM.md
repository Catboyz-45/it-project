# Document template system

Contracts and invoices use HTML templates stored in PostgreSQL. The server validates an allowlist of placeholders, escapes mapped values, sanitizes template HTML, generates an A4 PDF with Puppeteer, and stores the private file through a storage adapter.

## Local development

1. Copy `.env.example` to `.env` and change the development database password.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Install and generate the Prisma client: `npm install`.
4. Apply migrations: `npm run db:migrate`.
5. Start the app: `npm run dev`.

Generated PDFs are written under `LOCAL_STORAGE_PATH` with mode `0600`. The directory is excluded from Git and is never served from `public/`; downloads go through the document API.

## Switch to S3

Set these environment variables in the deployment secret store:

```env
STORAGE_TYPE=s3
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=your-private-bucket
AWS_S3_PREFIX=documents
```

Use an IAM role with only `s3:GetObject` and `s3:PutObject` for the configured bucket/prefix. Keep the bucket private. The adapter requests S3 server-side encryption and the application code does not need to change.

## API

- `GET /api/document-templates/:kind` loads or creates the default template.
- `PUT /api/document-templates/:kind` validates, sanitizes, and versions a template.
- `POST /api/documents/preview` generates a non-persisted PDF preview.
- `POST /api/documents` generates, stores, and records a PDF.
- `GET /api/documents/:id/download` streams a stored private PDF.

`kind` is `contract` or `invoice`. State-changing endpoints require same-origin JSON requests. Before exposing this deployment outside a trusted development environment, connect these routes to the application's server-side admin session/RBAC layer; the current dashboard login remains a client-side demo and is not an authorization boundary.

## Operations

- Back up PostgreSQL records and the configured document storage together.
- Restore both to the same point in time so database storage keys remain valid.
- Run `npm run db:deploy` during deployment; never run destructive migrations automatically.
- To roll back application code, retain old template versions and stored PDFs. Database migration rollback must be reviewed and executed manually.
