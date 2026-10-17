# Storage & Attachments

## What it is

Every file Nacora persists — quote PDFs, certificate PDFs, bulk-upload workbooks, bulk-upload error CSVs, exporter outputs, user-uploaded attachments — lands in S3 through Django's storage-backend abstraction. This page describes the storage backend, the attachment model, the folder hierarchy, presigned URL semantics, and the difference between public static assets and private user artefacts.

## Who owns it / who touches it

- **Backend engineers** attaching files to a domain object, generating documents, or reading a stored artefact back.
- **DevOps** provisioning buckets, IAM policies, lifecycle rules, encryption at rest.
- **Security** auditing access to sensitive attachments (certificates, policy documents).
- **Support** hunting a "where did that file go?" ticket.

## How it works

### Storage backend layer

Django's `DEFAULT_FILE_STORAGE` and `STATICFILES_STORAGE` control where uploaded files and static assets land. Nacora ships two backends:

| Backend | Purpose | Backing |
|---|---|---|
| `insurance.storage_backends.PrivateStorage` | User-uploaded attachments, generated PDFs, exporter outputs | S3, private ACL |
| `django.contrib.staticfiles.storage.StaticFilesStorage` | Static assets (CSS, JS, images, PDF templates) | Local disk or S3 (per env) |

`PrivateStorage` is a thin subclass of `storages.backends.s3boto3.S3Boto3Storage` that:

- Sets `default_acl = 'private'` — no public reads.
- Sets `file_overwrite = False` — writes to a unique path per file (based on UUID + original filename).
- Enables signed URL generation with a configurable expiry.

### Attachment model

Attachments to domain objects flow through the `Attachment` and `AttachmentFolder` models in `src/activities/models.py`:

| Model | Purpose | Key fields |
|---|---|---|
| `Attachment` | A file attached to any target object via GenericForeignKey. | `content_type`, `object_id`, `content_object` (GFK), `file` (FileField backed by `PrivateStorage`), `name`, `description`, `attachment_folder` (FK), `size`, `mime_type`, `uploaded_by`, `created_at` |
| `AttachmentFolder` | Hierarchical grouping. | `parent` (FK self), `name`, `content_type`, `object_id`, `is_default` |

Every domain object (Policy, PolicyVersion, PolicyVersionItem, BusinessPartner, Referral, SpecialRateRequest) can carry any number of attachments, organised into any number of folders.

### Folder hierarchy convention

Nacora uses a standard folder set on Policy and PolicyVersionItem:

- **Policy** — `documents/policy-schedule/`, `documents/wording/`, `documents/endorsements/`, `internal/`.
- **PolicyVersionItem (shipment)** — `documents/certificate/`, `documents/quote/`, `attachments/user-uploads/`, `internal/`.

`is_default` marks the folder created automatically by service code on object creation. The tree is traversed via the `parent` FK; folder listings are lazy.

### S3 layout

Bucket per environment (`nacora-attachments-dev`, `nacora-attachments-staging`, `nacora-attachments-prod`). Configured via `AWS_STORAGE_BUCKET_NAME`.

Key structure (approximately):

```
attachments/<content_type_slug>/<object_uuid>/<attachment_uuid>/<safe_filename>
documents/certificate/<policy_number>/<shipment_number>/certificate-<uuid>.pdf
documents/quote/<policy_number>/<shipment_number>/quote-<uuid>.pdf
exports/reports/<report_uuid>/<report_name>.xlsx
bulk-upload/errors/<report_uuid>/errors.csv
```

Reads are always via presigned URL — the app generates the URL on demand, never exposes raw bucket keys.

### Presigned URL generation

For every file served to a user, the service layer:

1. Calls `attachment.file.url` (or `PrivateStorage.url(key)` directly).
2. `S3Boto3Storage.url()` returns a presigned URL signed with the app's AWS credentials.
3. The URL includes an `Expires=<timestamp>` query parameter — default `AWS_QUERYSTRING_EXPIRE` (typically 3600s / 1 hour, sometimes 24h for large exporter outputs).
4. Client browser downloads directly from S3; the app doesn't proxy bytes.

**Presigned URLs are shareable.** Anyone with the URL can download until it expires. Sensitive files must have short expiry; log the URL generation with the requesting user.

**Regeneration on expiry.** A stale URL returns HTTP 403 from S3. UI code polls the app for a fresh URL rather than caching URLs client-side.

### Exporter outputs

`USE_S3_FOR_SCRIPT_REPORTS = True` — every async exporter run stores its output to S3 and stashes a presigned URL on the `Report` row. Expiry: 24h. The lifecycle policy on `exports/reports/` purges files after 30 days.

### Bulk-upload workbooks

- User-supplied workbooks are streamed to disk temporarily, parsed via `openpyxl`, and discarded — not persisted.
- Error CSVs (`bulk-upload/errors/<report_uuid>/errors.csv`) are stored in S3 with a presigned URL returned in the API response.

### Certificate PDFs

- Generated on demand by `DocumentGenerationService` in `src/clients/nacora/documents/services.py` (see Document Generation).
- Written to `documents/certificate/<policy_number>/<shipment_number>/certificate-<uuid>.pdf`.
- The URL is stored on the `PolicyVersionItem.details` JSON (audit trail excludes this field to avoid audit-noise on regenerate).
- On regeneration, a new UUID is minted and the old file is orphaned (not deleted immediately; lifecycle policy sweeps old files).

### IAM & bucket policies

- The app IAM role has `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:GeneratePresignedUrl` scoped to the environment's bucket.
- Bucket policy denies unencrypted uploads (SSE-S3 or SSE-KMS required).
- Public access is blocked at the bucket level — belt-and-braces on top of `default_acl = 'private'`.

### Static asset serving

Nacora frontend static assets (webpack outputs) are served differently:

- **Local dev.** Django serves `dist/apps/nacora-*/` via the static-file view.
- **Staging / prod.** `collectstatic` copies frontend `dist/` into `/app/public/`, and Nginx (or the CDN) serves it directly. Django is not in the read path.

Static assets are public by design (JS, CSS, images loaded from the browser).

### Feature flags

- `ENABLE_NEW_360_ATTACHMENTS = True` — routes attachments to the S3-backed storage. Off means fallback to legacy filesystem storage (only meaningful during a migration window).
- `USE_S3_FOR_SCRIPT_REPORTS = True` — routes async exports to S3 rather than serving inline.

## Configuration & operational levers

| Setting / env var | Purpose | Typical value |
|---|---|---|
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket for private files | `nacora-attachments-<env>` |
| `AWS_S3_REGION_NAME` | S3 region | `eu-central-1` |
| `AWS_S3_CUSTOM_DOMAIN` | CDN or CloudFront in front of S3 (optional) | Env-specific |
| `AWS_QUERYSTRING_EXPIRE` | Default presigned URL TTL (seconds) | `3600` |
| `AWS_DEFAULT_ACL` | Default S3 ACL for new files | `private` |
| `AWS_S3_FILE_OVERWRITE` | Overwrite on duplicate key | `False` |
| `AWS_S3_ENCRYPTION` | SSE mode | `AES256` (SSE-S3) or `aws:kms` |
| `AWS_S3_OBJECT_PARAMETERS` | Cache-Control, Content-Disposition defaults | Long cache for immutable outputs |
| `DEFAULT_FILE_STORAGE` | Django's default | `insurance.storage_backends.PrivateStorage` |
| `STATICFILES_STORAGE` | Static asset storage | `django.contrib.staticfiles.storage.StaticFilesStorage` or S3 variant |
| `ENABLE_NEW_360_ATTACHMENTS` | Feature flag for new storage backend | `True` |
| `USE_S3_FOR_SCRIPT_REPORTS` | Route exports to S3 | `True` |
| S3 lifecycle rule on `exports/reports/` | Purge exports after N days | 30 days |

## Constraints, guarantees, and gotchas

- **Private ACL always.** Do not `default_acl='public-read'` on any Nacora bucket. Public files go through the static-asset pipeline, not `PrivateStorage`.
- **Presigned URLs are shareable.** A support engineer who copies a certificate URL into Slack gives 1-hour anonymous access. Regenerate short-lived URLs and warn on-call.
- **Files are not deleted on record delete.** `Attachment.delete()` deletes the DB row but leaves the S3 object. A lifecycle policy sweeps orphans; there is no synchronous cleanup.
- **Certificate regeneration orphans the old file.** Never delete the previous file synchronously — audit trail entries may reference it for reconciliation.
- **Bulk-upload workbooks are not persisted.** If a broker asks "where's my upload?", the answer is that we only kept the parse result. The error CSV is retrievable via the Report record.
- **`AWS_QUERYSTRING_EXPIRE` is a global default.** Per-file overrides (e.g. 24h for exports) live in the service that generates the URL.
- **S3 encryption is server-side.** The app does not encrypt payloads; the bucket policy enforces SSE at write.
- **Cross-region reads are slow.** Keep the app and the bucket in the same region (`eu-central-1`).
- **Static assets bypass Django in prod.** Nginx / CDN serves them; Django settings for static files matter only in dev. Missing static assets in prod are a build/collectstatic problem, not a Django-config problem.
- **`file_overwrite = False`** — uploads with the same filename get a unique suffix. Callers must not rely on a stable key; use the returned URL / key.

## Related concepts

- Bulk Upload & Exporter
- Document Generation
- Environments & Config
- Third-Party Integrations — Failure Modes
- Data Model & Entities
