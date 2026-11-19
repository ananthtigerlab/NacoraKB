# SOAP Inbound Integration

## What it is

NacoraHub exposes a set of SOAP web-service operations that mirror the legacy Salog **ShipmentWebService**, so Kuehne+Nagel operational systems and other automated shippers can book shipments, verify coverage, retrieve certificates, amend shipments, and cancel shipments programmatically — no GUI, no login screens, just XML over HTTPS. This is the primary integration path for K+N's bulk operational traffic. Customers who previously integrated against Salog can point their client at NacoraHub's SOAP endpoint with only credential and URL changes; the semantics are preserved.

The SOAP surface is a compatibility layer over the platform's normal shipment workflow. Under the hood, a `BookShipment` call performs the same declaration, rating, and booking sequence that a participant would do manually through the Shipment Portal. The advantage of the SOAP path is throughput — a K+N regional operations centre can book thousands of shipments a day through the SOAP endpoint without human interaction.

## Who uses it & where

- **Kuehne+Nagel shipper systems** — automated booking flows during their logistics workflows. The typical pattern is: a KN operational system creates a booking record in their own platform, marshals the shipment details into a SOAP request, and calls NacoraHub to bind the cargo cover.
- **Third-party logistics platforms** — use the same interface they had against Salog. NacoraHub is designed as a drop-in replacement.
- **Quoting bots** — call `VerifyCoverage` before offering a rate externally to their own customer, so their quote reflects Nacora's actual pricing.
- **Nacora operations and support** — do not invoke the SOAP endpoints directly, but investigate SOAP requests when a shipment fails to book from the automated path. Every SOAP request is logged with its message ID, request, response, and any faults.

The SOAP endpoint is a service-to-service interface; end users never interact with it directly. The Backoffice has a SOAP request log accessible to Nacora operations for triage.

## How it works

### Authentication

SOAP clients authenticate using **WS-Security UsernameToken** — a username and password pair carried in the SOAP header of every request. The credential pair is stored in the platform's configured SOAP user list; each SOAP user is tied to a specific broker company or participant company, and requests can only affect records scoped to that ownership.

The username also determines rate limits and access controls. A client authenticated as a KN Poland shipper can only book shipments against KN Poland policies.

### The operations

The endpoint exposes six operations. Each operation has its own request and response schema mirroring the Salog contract.

**BookShipment.** The core operation. Given a shipment declaration (assured, trip, cargo, insured value, currency), rate the shipment against the referenced policy and book it. The response carries the resulting shipment number, the premium breakdown, and a reference to the certificate document.

**VerifyCoverage.** Given a shipment declaration and a policy reference, rate the shipment and return the premium — but do not book. Used by quoting bots to preview a price before deciding whether to book.

**GetCertificate.** Given a shipment number (or a certificate number), return the certificate PDF. Because certificates can be large, the PDF is streamed as base64 in chunks so that a single 5 MB certificate does not overflow the SOAP message size limit.

**QueryShipment.** Given a shipment number, return the current status and key attributes of the shipment. Used by external systems to check whether a shipment is Booked, Referred, Cancelled, or Expired.

**ChangeShipment.** Given a shipment number and updated attributes, endorse the shipment. Semantically equivalent to the Amend Shipment action in the Shipment Portal. Creates a new endorsement, re-issues the certificate, and returns the updated shipment number with its endorsement suffix.

**CancelShipment.** Given a shipment number and a cancellation reason, raise a cancellation request for back-office review. The Salog client cannot answer the arrival-status question, so the back office must approve before the cancellation becomes final and billing reads it. The SOAP response reports a pending status until the back office decides; the final CAN status is returned only once the shipment is actually cancelled. A service account can opt into immediate cancellation (bypassing the approval queue) when its SOAP user record is configured with direct cancellation enabled.

### Request handling

Every incoming request goes through the same pipeline.

1. **WS-Security check.** Reject with an authentication fault if the username/password does not resolve.
2. **Message ID lookup.** Every request carries a unique message ID in the SOAP header. Look up whether a response has already been cached for this ID; if so, return the cached response verbatim (see idempotency below).
3. **Parse the message.** Extract the header attributes (sender, receiver, locale) and the operation-specific body (shipment info, policy reference, and so on).
4. **Code map translation.** External Salog codes are translated into Nacora's internal choice keys using the platform's code map. For example, Salog's conveyance code `FS` becomes Nacora's `Sea`; `AL` becomes `Air`; `RD` becomes `Road`. If a code cannot be translated, a mapping fault is raised.
5. **Policy lookup.** Look up the target policy. The platform is configurable at deployment time to look up by the external policy number provided in the request or by the internal `MC-XXXXXX` number.
6. **Build the shipment.** Assemble an internal Shipment record from the SOAP payload.
7. **Run rating.** Pass the shipment through the rating pipeline as if it had been declared through the portal.
8. **Response validation.** If the rated premium comes back as zero, reject the operation with a `ZERO_PREMIUM` fault rather than silently booking. This is a deliberate safety catch against misconfiguration.
9. **Book (or verify).** For `BookShipment`, transition the shipment to Booked, generate the certificate, and cache the response. For `VerifyCoverage`, return the premium breakdown without booking.
10. **Cache the response.** Store the response against the message ID with a 90-day retention window.
11. **Return the response.** The SOAP response carries the shipment number, the premium breakdown, and any additional fields specific to the operation.

### Idempotency

Every request carries a unique message ID in the SOAP header. The response for each message ID is cached for 90 days. If the same message ID is replayed — for any reason, whether client-side retry, network duplication, or accidental re-run — the cached response is returned without re-running the operation. This means a client can safely retry on network failure without worrying about double-booking.

The 90-day cache is a compromise between safety (long enough to catch delayed retries) and storage (short enough to avoid unbounded growth). Beyond 90 days, a repeat with the same message ID is treated as a fresh request.

### Duplicate booking detection

Separate from the message-ID cache, the platform detects when a booking request repeats an earlier one even when the client sends a new message ID (a common pattern when the KN ESB retries a booking it believes failed). A request is treated as a repeat when the same policy already has a shipment created within a configurable time window (default seven days) under the same ShipmentReferenceNo, and, when the request names one, the same NacoraShipmentID. No other fields are compared — if a Salog client needs to change a booked shipment, the correct path is ChangeShipment, not a new booking.

When a repeat is detected, the platform returns the existing shipment's current state as a normal success response. Nothing new is created. The duplicate check never blocks a booking: any error during the check is logged and the booking proceeds as normal.

### Fault codes

The endpoint returns SOAP faults for every error. Faults are structured with a code and a human-readable reason.

| Fault code | When it fires | Client action |
|---|---|---|
| `AUTH_FAILED` | Username/password did not resolve. | Verify credentials. |
| `POLICY_NOT_FOUND` | The referenced policy does not exist or is not accessible to this SOAP user. | Verify policy number and SOAP user scope. |
| `POLICY_NOT_ACTIVE` | The policy exists but is in Draft, Config Complete, Cancelled, or Expired. | Check policy status; wait for activation or use a different policy. |
| `COMMODITY_NOT_MAPPED` | The Salog commodity code cannot be translated to a Nacora commodity group. | Verify the commodity code; ask administrator to add mapping. |
| `CONVEYANCE_NOT_MAPPED` | The Salog conveyance code cannot be translated. | Same. |
| `COVERAGE_NOT_MAPPED` | The Salog coverage code cannot be translated. | Same. |
| `COUNTRY_NOT_MAPPED` | A departure or destination country cannot be resolved. | Verify country codes are ISO 3166-1 alpha-2. |
| `INSURED_VALUE_INVALID` | Insured value is missing, negative, or not a number. | Correct the payload. |
| `CURRENCY_NOT_ALLOWED` | The insured value currency is not on the policy's billing settings. | Use a currency the policy allows. |
| `ZERO_PREMIUM` | The rating engine returned zero — usually a configuration gap. | Investigate rating configuration; do not silently book. |
| `RATING_FAILED` | The rating engine failed for another reason. | Investigate; response contains the error detail. |
| `SANCTIONS_MATCH` | A sanctions check hit; the shipment cannot be auto-booked and has been referred. | Wait for underwriter review; monitor the shipment status via `QueryShipment`. |
| `SHIPMENT_NOT_FOUND` | The shipment number in a `GetCertificate`, `QueryShipment`, `ChangeShipment`, or `CancelShipment` request does not exist. | Verify the shipment number. |
| `SHIPMENT_NOT_BOOKED` | `ChangeShipment` or `CancelShipment` was called against a shipment not in Booked or Booked – Endorsed. | Check the shipment status. |
| `CERTIFICATE_NOT_READY` | `GetCertificate` was called before the certificate PDF finished rendering. Response includes a `Retry-After` header. | Wait the indicated interval and retry. |
| `MESSAGE_TOO_LARGE` | Request exceeded the 2 MiB message size limit. | Split into multiple smaller requests. |
| `IDEMPOTENCY_CONFLICT` | The same message ID was reused with a different payload. | Change the message ID or reconcile the payload. |
| `RATE_LIMITED` | The SOAP user has exceeded its per-minute request cap. | Back off and retry. |

Every fault is logged with the request payload, the SOAP user, and the timestamp for Nacora operations to inspect.

### Certificate streaming

`GetCertificate` returns the certificate PDF as base64. To avoid overflowing the 2 MiB message size limit on larger certificates (bilingual certificates with heavy branding can exceed 2 MB raw), the payload is chunked. Each chunk carries a sequence number and a total-chunks count; the client reassembles them in order. If the PDF is not yet ready when the client calls, the response returns a `CERTIFICATE_NOT_READY` fault with a `Retry-After` header indicating how long to wait before trying again.

### Dry-run flag

Non-production environments support a `dryRun` flag on `BookShipment`. When set, the operation runs the full validation pipeline (auth, mapping, policy lookup, rating) and returns the response — including any fault — without persisting anything to the database. This is the correct way for a client team to test their integration without polluting the environment with test bookings. The flag is ignored on production; production always books.

### REST interface

The same shipment operations are also available as a REST (JSON) interface at the integrations API endpoint. Each REST call is translated into the same dispatcher and handlers used by the SOAP channel, so both interfaces share identical business rules, validation, and error keys. REST bodies use the same field names as the WSDL types, with arrays replacing the SOAP ArrayOf wrappers and element text carried as a Value field.

Authentication is HTTP Basic against the same SOAP user list. Unlike the SOAP channel, REST calls carry no message ID, so they have no replay protection through the message-ID cache (the duplicate booking detection still applies to bookings). The REST surface can be enabled or disabled independently of the SOAP endpoint through a deployment setting. An OpenAPI specification is generated from the WSDL and served at the integrations endpoint for client teams to reference.

### ChangeShipment behaviour

ChangeShipment endorses a booked shipment against the shipment's own policy version. It no longer creates an unwanted MTA draft on the master policy — the endorsement is applied directly to the shipment and a new certificate is issued. This matches how the Shipment Portal applies an amendment.

### Premium fields in responses

SOAP responses report the cargo premium in the standard premium fields (such as MarinePremiumAmount), not the total cost including charges. Charge breakdowns are included separately where the response schema supports them.

### The SOAP request log

Every SOAP request is logged in the Backoffice under Admin → Integrations → SOAP Log. Each entry shows:

- Timestamp.
- SOAP user.
- Operation.
- Message ID.
- Request payload (redacted for credentials).
- Response payload.
- Any fault code.
- The related record if one was created (shipment number, certificate number).

Nacora operations use this log to triage bookings that failed on the client side. Filtering by fault code, by SOAP user, or by date range narrows quickly to the incident being investigated.

## Options & choices

### Supported operations

| Operation | Purpose | Idempotent |
|---|---|---|
| `BookShipment` | Rate and book a shipment | Yes (via message ID) |
| `VerifyCoverage` | Rate without booking | Yes |
| `GetCertificate` | Return the certificate PDF | Yes |
| `QueryShipment` | Return shipment status and attributes | Yes |
| `ChangeShipment` | Endorse a booked shipment | Yes (via message ID) |
| `CancelShipment` | Cancel or request cancellation of a shipment | Yes (via message ID) |

### Locale codes supported in the header

The `locale` header attribute selects the response language for user-facing strings (fault reasons, certificate content). Supported values: `en`, `fr`, `de`, `es`, `ja`, `zh`, `tr`, `pt`. If omitted, English is used.

### Configuration switches

| Setting | Default | Effect |
|---|---|---|
| Policy lookup mode | Internal number | Toggle to allow lookup by external policy reference instead of internal `MC-XXXXXX` |
| Idempotency window | 90 days | Retention for cached responses |
| Max message size | 2 MiB | Hard limit; larger requests are rejected |
| Certificate chunk size | 256 KiB | Size of each base64 chunk in `GetCertificate` |
| Dry-run flag honoured | Only in non-production | Ignored on production |

## Business rules & calculations

- **Zero premium is a rejection.** The SOAP flow will not allow a booking with zero premium; a `ZERO_PREMIUM` fault fires. This protects against silent misconfiguration.
- **Idempotency by message ID.** A replay of the same message ID within 90 days returns the cached response verbatim, not a duplicate booking.
- **Retention:** cached responses expire after 90 days.
- **Max request size:** 2 MiB per SOAP call — enough for a full shipment but not for embedded attachments; attachments must be uploaded separately through the platform's file API.
- **Dry-run flag available in non-production** — bypasses database mutations while exercising the full validation path.
- **Certificate not ready:** if the PDF has not finished rendering, the response is `CERTIFICATE_NOT_READY` with a `Retry-After` header.
- **Code map is deployment-configurable.** The Salog → Nacora conveyance, commodity, and coverage code maps are maintained in the Choices module. New codes require an administrator to add the mapping before SOAP clients can use them.
- **Policy lookup mode is deployment-fixed.** Once a deployment has committed to internal-number or external-number lookup, changing it is a support intervention, not a runtime switch.
- **Rate limits are per SOAP user.** A misbehaving client cannot degrade the endpoint for other users; requests over the cap return `RATE_LIMITED` and are counted for operations monitoring.
- **Sanctions matches route to referral.** A `SANCTIONS_MATCH` fault does not mean the shipment is lost — it has been created and referred to underwriting. The client should poll `QueryShipment` for the outcome.
- **All faults are audited.** Every fault is stored in the SOAP request log with the full request/response for later inspection.
- **Duplicate booking detection by reference.** A booking with the same policy, ShipmentReferenceNo, and NacoraShipmentID (when present) as an existing shipment created within seven days is answered with the existing shipment rather than creating a duplicate. This operates independently of the message-ID cache.
- **Salog cancellations default to approval.** CancelShipment raises a pending request for back-office review unless the SOAP user is explicitly configured for direct cancellation. The SOAP response shows a pending status until the back office decides.
- **REST interface available.** The same operations are served as JSON at the integrations API endpoint, sharing all business rules with the SOAP channel. REST calls have no message-ID replay protection.
- **Premium fields report cargo premium.** SOAP response premium fields carry the cargo premium, not the total cost including charges. Charge breakdowns are reported separately.

## States & transitions

### Request lifecycle

- **Received** — the request has arrived and passed WS-Security.
- **Cached hit** — the message ID matches a cached response; the cached response is returned. Terminal for this request.
- **Processing** — the request is being handled by the pipeline.
- **Response sent** — the response has been dispatched; the response is cached against the message ID.
- **Fault sent** — a SOAP fault has been dispatched; the fault is cached against the message ID.

### Downstream shipment state

The shipment created or affected by a SOAP call follows the standard shipment state machine (see Shipment Statuses). `BookShipment` typically transitions the shipment straight to Booked. If the rating engine cannot resolve the shipment automatically the shipment lands in Referred and the SOAP response returns a `SANCTIONS_MATCH` (for sanctions-triggered referrals) or a generic referral notice.

## Related concepts

- Bulk Upload
- Rating
- Choices
- Documents
- Sanctions & Compliance
- Shipment Statuses
- Numbering
- Audit Trail Module
- Cancellations
