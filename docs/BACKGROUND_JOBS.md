# Background maintenance jobs

The maintenance worker runs seven idempotent tasks:

1. Mark unpaid invoices past `dueDate` as `OVERDUE` and recalculate one
   `LATE_FEE` item from the property's current settings.
2. Publish `SCHEDULED` announcements whose `publishAt` is due.
3. Mark `TRIAL` or `ACTIVE` subscriptions past `expiresAt` as `EXPIRED`.
4. Purge reviewed payment-slip files after the configured retention period.
5. Purge generated documents that are no longer linked to a live or recently
   ended lease.
6. Purge signed lease files only after the lease is `EXPIRED` or `CANCELLED`
   and its end date is beyond the document retention period.
7. Purge chat attachment files after the configured retention period.

Database-only tasks run in one serializable PostgreSQL transaction. A
transaction-level advisory lock prevents overlap during that database phase.
File deletion is performed afterward in bounded, concurrency-safe and
idempotent batches so external storage calls do not hold database locks. A
concurrent invocation detected during the locked phase returns HTTP `202` with
`status: "already_running"`.

Retention removes private file contents and clears their storage references.
Invoice/payment, document, lease and chat-message business records remain in
PostgreSQL, together with a purge timestamp. Pending payment slips and files
belonging to active leases are never selected for cleanup.

## Configuration

Generate a secret outside the repository and provide the same value to the app
and scheduler:

```bash
openssl rand -base64 48
```

```dotenv
JOB_SECRET="<at-least-32-random-characters>"
JOB_INTERVAL_SECONDS="300"
SLIP_RETENTION_DAYS="365"
DOCUMENT_RETENTION_DAYS="2555"
CHAT_ATTACHMENT_RETENTION_DAYS="365"
RETENTION_BATCH_SIZE="100"
```

`RETENTION_BATCH_SIZE` is capped at 500. Review legal and institutional data
retention requirements before shortening these values. Apply the accompanying
Prisma migration before enabling cleanup; do not run destructive migrations
automatically against production.

Docker Compose starts the `maintenance` service after the app is healthy. For
managed hosting, invoke the endpoint from the platform scheduler every five
minutes:

```http
POST /api/internal/jobs/maintenance
Authorization: Bearer <JOB_SECRET>
```

The endpoint returns only aggregate counts and never logs the secret. Keep it
private, rotate it through the deployment secret manager, and do not expose it
to browser code.
