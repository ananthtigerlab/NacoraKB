# Zurich E-Sign Integration

Zurich e-sign is an integration that digitally stamps and signs insurance certificates issued for Nacora China policies where Zurich is the lead insurer. The signing happens automatically when a certificate is generated, and the signed version replaces the original in place.

## Who uses it and where

The integration runs in the background. Brokers and policyholders see signed certificates when they download them from the Shipment Portal at nacora-sp.i2go.io or receive them by email. Administrators can trigger re-signing from the command line. The back office at nacora-bo.i2go.io shows signing status in the third-party API event log.

## How it works

### Eligibility

A certificate is eligible for signing when all of these are true:

- The shipment belongs to a Nacora China policy
- The lead insurer is Zurich
- The integration is switched on in Nacora's client settings
- The Vault-driven credentials (client ID, client secret, auth URL, e-sign URL) are configured for the environment

### Signing flow

1. A certificate is generated — whether by booking, regeneration, adding a language, SOAP inbound, or bulk backfill.
2. The system checks eligibility. If not eligible, the certificate is left unsigned.
3. The system obtains an OAuth token from Zurich's authentication service. Tokens are cached and reused until they expire.
4. The certificate PDF is sent to Zurich's e-sign endpoint along with a business reference, the stamp marker position and stamp size.
5. Zurich returns the signed PDF. The signed version overwrites the original attachment in place — the same file, the same links.
6. The attachment is marked as signed with a summary of the signing result.
7. Every call to Zurich is traced as a third-party API event for audit and troubleshooting.

### Failure handling

- If signing fails with a retryable error (authentication error, signing error, PDF read failure, storage failure), the system schedules automatic retries at increasing intervals (5 minutes, 15 minutes, 45 minutes).
- If signing is rejected or the certificate is already signed, no retry is scheduled.
- Each retry attempt is recorded. The operator can see the full history in the API event log.

### Re-sign command

Administrators can re-sign certificates for specific shipments using a management command. This finds all current, unsigned certificates in the standard certificate folders (Original, Duplicate, Copy, Combined) and signs them. It runs as a dry run by default and writes only when explicitly committed.

### Go-live control

The integration is controlled by a Vault-driven setting per environment. Each environment (dev, NUAT, UAT, hotfix, prod) has its own Zurich credentials. The integration does nothing when the setting is disabled, so it can be turned off without a code change.

## Business rules and calculations

- Only Nacora China policies with Zurich as lead insurer are eligible
- Certificates already signed are never sent again
- The stamp is placed at the marker text position on the certificate with a configurable size (default 40mm)
- Token caching avoids repeated authentication calls within the same token's validity period
- Retries are limited to three attempts at escalating delays
- A signed certificate keeps the same attachment ID and download link — nothing changes for the recipient

## Related concepts

- Document Generation — certificates must be generated before they can be signed
- Clauses — certificate wording per conveyance determines what is printed before signing
- SOAP Inbound Integration — Salog-booked shipments also get their certificates signed
- Third-Party Integrations — Zurich e-sign follows the standard API event tracing pattern
