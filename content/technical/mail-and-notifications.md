# Mail & Notification Pipeline

## What it is

Every transactional email Nacora sends — OTP codes, referral notifications, renewal reminders, lockout warnings, quote-ready messages — travels through the same pipeline: templated by `django-post-office`, queued in PostgreSQL, drained by a periodic Celery task, and delivered by Amazon SES via `django-anymail`. This page describes the backend pipeline (queue, template versioning, service classes, delivery guarantees). The user-facing catalogue of templates and business triggers lives on the Product-space "Mail Notifications & Templates" page.

## Who owns it / who touches it

- **Backend engineers** wiring new notification triggers, editing service classes, or adding template versions.
- **DevOps** operating SES (verified senders, sending domains, bounce handling).
- **On-call** investigating a stuck mail queue or a bounced batch.
- **Support** re-sending a failed email from the mail-queue admin.

## How it works

### Pipeline components

| Component | Role |
|---|---|
| `django-post-office` | Queue + template engine. Provides the `Email` and `EmailTemplate` models. |
| `django-anymail` | Bridges Django's email API to a modern provider (SES). Configured via `POST_OFFICE['BACKENDS']`. |
| **Amazon SES** | Delivery. Verified sender domains, IAM-role authenticated, bounce/complaint notifications via SNS. |
| **`send_queued_mails`** | Nacora Celery task (`nacora.mails.send_queued_mails`) — drains the queue. |
| **Nacora mail services** | `src/clients/nacora/mails/services.py` — declarative senders (`send_templated_notification`) plus mail queryset filter service. |
| **Template files** | Under `src/clients/nacora/templates/` — HTML + text bodies, with Jinja-2-style variables. |

### End-to-end flow

1. **Trigger.** Service code (referral service, cancellation service, rule engine, cron reminder) calls `send_templated_notification(template_slug, to, context)` in `src/clients/nacora/mails/services.py`.
2. **Template resolution.** The service looks up the `EmailTemplate` by slug and the correspondent language (`BusinessPartner.correspondence_language` where applicable, falling back to `LANGUAGE_CODE`).
3. **Context binding.** The template is rendered with the provided context (policy details, shipment number, deep-link URL, actor name, etc.). Missing context keys raise a template error at send time.
4. **Queue insertion.** An `Email` row is inserted with `status = queued`, `to`, `subject`, `html_message`, `message` (text fallback), scheduled time, and attachments.
5. **Queue drain.** `nacora.mails.send_queued_mails` runs every 2 minutes (`crontab(minute='*/2')`), calls `post_office.mail.send_queued`, which batches queued emails and hands them to the anymail backend.
6. **SES send.** The anymail backend converts to a SES SendEmail / SendRawEmail call. On success, the `Email` row transitions to `sent`.
7. **Bounce / complaint.** SES SNS notifications post to a dedicated webhook endpoint; matching `Email` rows flip to `failed` with the SES reason attached.

### The `send_templated_notification` service

Declarative helper for the common case. Signature:

```python
send_templated_notification(
    template_slug: str,            # EmailTemplate slug — e.g. 'nacora_referral_created'
    to: list[str] | User | BusinessPartner,
    context: dict,
    attachments: list[File] | None = None,
    language: str | None = None,   # override the recipient's correspondence language
    scheduled_time: datetime | None = None,
)
```

Behaviour:

- Resolves the sender based on `DEFAULT_FROM_EMAIL` (or a per-template override on the `EmailTemplate.default_priority` extra).
- Enforces the recipient allow-list in dev (`ALLOWED_MAIL_RECIPIENTS`) — a dev-only setting that silently drops emails to anyone outside the list. Never active in prod.
- Attaches audit metadata (originating actor, related object) to the `Email.extra` field for later traceability.

### Anymail backend

Configured in `settings.py`:

```
POST_OFFICE = {
    'BACKENDS': {
        'default': 'anymail.backends.amazon_ses.EmailBackend',
    },
    'DEFAULT_PRIORITY': 'medium',
    'BATCH_SIZE': 100,
    'MESSAGE_ID_ENABLED': True,
}
ANYMAIL = {
    'AMAZON_SES_CLIENT_PARAMS': {
        'region_name': AWS_REGION_NAME,
    },
}
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'no-reply@nacorahub.com')
```

`AMAZON_SES_CLIENT_PARAMS` is provided by an IAM role or explicit credentials — the same AWS credentials used for S3, Bedrock, and Comprehend.

### Template model

`django-post-office`'s `EmailTemplate` provides:

- `name` (slug) — the lookup key.
- `subject` — Jinja-templated.
- `content` — text body, Jinja-templated.
- `html_content` — HTML body, Jinja-templated.
- `language` — one row per language variant. Look-up chooses the recipient's `correspondence_language` first, then `LANGUAGE_CODE`, then any row.

Template edits are managed through Django admin (`/tiger-site-admin/post_office/emailtemplate/`) — see Django Admin.

**Language coverage.** Nacora ships EN, FR, DE, ES, JP, CN, TR, PT template rows. Adding a language for a template is a data operation, not a code change.

### Nacora template inventory (canonical slugs)

| Slug | Trigger | Recipients |
|---|---|---|
| `nacora_otp_code` | `drfpasswordless` OTP request | Participant email |
| `nacora_referral_created` | `Referral` created by rule engine or manual submit | Assigned underwriter |
| `nacora_referral_decision` | Referral status transition (APPROVED/DECLINED/MORE_INFO) | Originating broker/participant |
| `nacora_srr_submitted` | `SpecialRateRequest.status → PENDING` | Underwriter |
| `nacora_srr_decision` | SRR decision (APPROVED/DECLINED) | Requester |
| `nacora_quote_ready` | Quote finalised on a shipment | Participant / broker |
| `nacora_certificate_ready` | Certificate PDF minted (async) | Participant |
| `nacora_policy_renewal_reminder` | Beat task, 30/14/7 days before expiry | Broker |
| `nacora_lockout_notification` | Password lockout after `MAX_LOGIN_ATTEMPTS` | Locked user |
| `nacora_pending_approval_notification` | SSO fell into pending-approval queue | Admin queue notification |
| `nacora_bulk_upload_summary` | Bulk upload complete | Uploader |
| `nacora_bulk_rerate_summary` | Bulk re-rate complete | Requesting admin |
| `nacora_bordereau_ready` | Monthly bordereau generated | Configured recipients |
| `nacora_cancellation_notification` | Policy cancelled | Broker + policyholder |
| `nacora_endorsement_notification` | Endorsement published | Broker + policyholder |

Every slug maps to language variants; every variant has a subject + HTML + text body.

### Mail queue queryset scoping

`OutboundMailQuerysetFilterService` (registered as `CUSTOM_QUERYSET_SERVICE.OutboundMail`) filters the `/api/v1/mails/` list endpoint by user role — brokers see mail relating to their own policies, admins see everything. Prevents cross-tenant mail leakage in the queue UI.

### Retry & bounce handling

- **`send_queued_mails`** re-attempts a `queued` mail on each pass. A mail stuck in `queued > 30 minutes` is a signal for investigation.
- **SES bounce** — SNS notification updates the row to `failed`. Not automatically retried; a hard bounce means the address is dead. Support can manually re-send after correcting the address.
- **SES complaint** — same path as bounce. Address gets suppressed at the SES level.
- **Retry budget.** SES imposes its own send quotas per environment; the pipeline respects them (batch size 100).

### Attachments

- Attachments are files (PDF certificates, XLSX bulk-upload error CSVs). Post-office stores attachment metadata in `Email.attachments` and the file itself either inline (small) or referenced from S3 via a URL (large).
- SES has a 40 MB total-message limit including attachments. Nacora does not enforce this at the app layer — a too-large attachment fails at send.

### Inbound mail

Not currently a Nacora feature. `src/mails/` includes an inbound-mail parser at the platform level; Nacora does not wire it. Any inbound-mail request goes to the broker's own inbox, not to a system endpoint.

## Configuration & operational levers

| Setting / env var | Purpose | Typical value |
|---|---|---|
| `POST_OFFICE['BACKENDS']['default']` | Anymail backend | `anymail.backends.amazon_ses.EmailBackend` |
| `POST_OFFICE['DEFAULT_PRIORITY']` | Default queue priority | `medium` |
| `POST_OFFICE['BATCH_SIZE']` | Emails per drain batch | `100` |
| `POST_OFFICE['MESSAGE_ID_ENABLED']` | Include a Message-ID header | `True` |
| `ANYMAIL['AMAZON_SES_CLIENT_PARAMS']['region_name']` | SES region | `eu-central-1` |
| `DEFAULT_FROM_EMAIL` | Fallback sender | `no-reply@nacorahub.com` |
| `ALLOWED_MAIL_RECIPIENTS` | Dev-only recipient allow-list | Empty in prod |
| Celery Beat entry `send_queued_mails` | Drain frequency | `crontab(minute='*/2')` |
| SES SNS webhook | Bounce/complaint notification target | Per-env endpoint |

## Constraints, guarantees, and gotchas

- **2-minute drain latency.** Emails are not sent instantly — up to 2 minutes to leave the queue. Acceptable for transactional email; not for real-time alerts.
- **At-least-once semantics.** A queued email may send more than once if the drain task retries on transient failure. Post-office's `MESSAGE_ID_ENABLED` and SES's dedup make this rare, but not impossible.
- **Template edits are hot.** Editing a template in the admin takes effect on the next drain. There is no cache to invalidate.
- **Language fallback is silent.** A missing German variant means the recipient gets English. Support cannot detect this without checking the admin.
- **`send_templated_notification` raises on missing context.** A rendering error puts the email into `failed` with a Jinja traceback. Do not call the service without validating context keys.
- **SES verified senders.** New sender addresses (`DEFAULT_FROM_EMAIL`) require SES verification per env. `DEFAULT_FROM_EMAIL` change → SES config change → deploy.
- **Bounces do not block business flows.** A bounced quote-ready email does not fail the quote; the broker will see the quote in the UI regardless.
- **Post-office admin is unsafe with high mail volume.** Editing an `EmailTemplate` while `send_queued_mails` is running can race — prefer editing during a quiet window.
- **`ALLOWED_MAIL_RECIPIENTS` must be empty in prod.** A stray dev-mode setting has silently dropped production emails in the past; the deploy contract explicitly clears it.

## Related concepts

- Background Jobs & Celery
- Third-Party Integrations — Failure Modes
- Storage & Attachments
- Django Admin
- Business Rules Engine
