# Media and object storage

The CMS stores images and PDF catalogs in a private S3-compatible bucket. The
database stores metadata and references only; uploaded bytes are never written
to the application filesystem.

## Configuration

Set `S3_ENDPOINT` for providers such as Cloudflare R2, MinIO, or DigitalOcean
Spaces. It can be omitted for AWS S3. Set `S3_FORCE_PATH_STYLE=true` when a local
MinIO installation requires path-style requests. Keep the bucket private.

The bucket CORS policy must permit `PUT` from the exact CMS origin and the
`Content-Type` header. Do not use a wildcard production origin:

```json
[{"AllowedOrigins":["https://cms.example.co.th"],"AllowedMethods":["PUT"],"AllowedHeaders":["Content-Type"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":300}]
```

The runtime identity needs only GetObject, PutObject, DeleteObject, and
ListBucket for the configured bucket/prefix. Keep credentials in the hosting
secret manager.

## Upload lifecycle

The server creates a random temporary key and returns a 15-minute signed PUT.
After direct upload, the completion endpoint checks size, MIME and magic bytes,
then computes SHA-256. Images are orientation-normalized, metadata-stripped, and
emitted as WebP and AVIF at 320, 640, 1280, and up to 1920 pixels without
enlargement. Metadata and variants become READY together; temporary objects enter
a durable cleanup queue.

PDFs and draft-only images remain private. Published references are delivered
through `/api/media/<id>` using short-lived signed redirects. Public access also
requires the referencing record to be non-trashed and past its publication time;
Draft, Archived, future-scheduled, and trashed records do not expose their media.

## Cleanup and deletion

Run this idempotent command at least hourly from one scheduled job:

```bash
npm run media:cleanup
```

Deletion first verifies relational references, then soft-deletes metadata for 30
days. Cleanup transactionally creates a durable deletion task before removing
metadata. Object deletion retries with exponential backoff. Expired and failed
uploads use the same path. Monitor unfinished `StorageCleanupJob` rows.

Dashboard usage is the sum of known PDFs and image derivatives. Provider metrics
remain authoritative because they can include multipart remnants or foreign
objects.

## Operational limitation

Signature and decoder validation are implemented, but malware scanning is not
included because no scanner is configured. Enable provider-side scanning or an
asynchronous quarantine scanner before production where supported.
