# 3rd Party Integrations

## What it is

Nacora depends on several external services to work end-to-end. Currency conversion, cargo-description sanctions screening, employee identity resolution, vessel classification, geographic address autocomplete, geographic risk enrichment, and LLM-based commodity classification are all outsourced to specialist providers. Every integration has a feature flag and a fallback so the system degrades gracefully when a provider is down.

## Who uses it & where

Every user is affected indirectly:

- **Rating** uses daily FX rates from currencyapi.com.
- **Sanctions screening** on every shipment uses AWS Comprehend to extract entities and SanctionScanner (with local OFAC fallback) to match them.
- **Login** uses the Kuehne+Nagel PDM API to resolve users to cost centres.
- **Shipment form (departure/destination)** uses Google Maps API for address autocomplete.
- **Business rules for sea freight** use the Vessel Finder API for IMO lookups (IACS classification, vessel age).
- **Analytics enrichment** pushes booked shipments to GeoRisk for geographic risk scoring.
- **Commodity classification** uses AWS Bedrock LLMs to suggest categories from free-text.

## How it works

**Currency (currencyapi.com)**

- A daily cron **at 12:00 midnight** fetches USD-based cross rates.
- Every conversion at rating time goes through USD (from → USD → to).
- **Shipments quoted during the day use the rate synced overnight** — effectively the previous day's rate. A shipment quoted at 09:00 uses last night's rate.
- Missing rates are stored as null on the base-currency amount — never a silent 1:1 fallback. Analytics excludes null-rate rows from aggregations.
- History note: Nacora originally requested an external FX provider, but currencyapi.com was implemented first and the switch didn't happen in time. Live with currencyapi.com for now.

**Google Maps API**

- Departure and destination address fields on the shipment form use Google Maps autocomplete.
- Reduces free-text errors; standardises country codes for the rating lookup.

**Vessel Finder API**

- Called when a sea shipment's IMO number is entered.
- Returns vessel name, flag, year built, vessel type, and H-value (a hull class indicator).
- Business rules consult this data: **not IACS-classified → refer**; **older than N years → refer**.
- Data is stored on the shipment for audit.
- **Currently dormant** because MVP is road-only. Activates when sea freight goes live.

**Cargo sanctions (AWS Comprehend + SanctionScanner)**

- On every submitted shipment, the cargo description is sent to Comprehend for entity extraction (people, organisations, places).
- Entities are filtered by confidence — organisations at 85%+, people at 60%+, up to 10 entities per request.
- A local noise block-list removes common shipping paperwork tokens ("marks & nos", "carton", "pallets") to reduce false positives.
- Surviving entities are sent to SanctionScanner for fuzzy matching against sanctions lists. Match rates between 85% and 100% flag the shipment for underwriter review.
- A local OFAC SDN list acts as offline fallback.

**KN PDM API (login identity)**

- At SSO time, the user's employee identifier is looked up against the K+N person-data workforce API.
- The response resolves the person to a cost centre → a participant company.
- Live API has a 10-second timeout, then falls back to a static JSON mapping file.
- If both fail, the user enters the pending-approval queue.

**GeoRisk webhook**

- When a shipment is booked, a webhook posts the shipment data to GeoRisk for geographic risk analysis.
- Async via Celery, three retries with exponential backoff on failure.

**AWS Bedrock (commodity classification LLM)**

- LLM-based suggestion (see Commodity Group Suggestion page). Only Bedrock use case in the product.
- Temperature 0.3 for deterministic outputs.

## Business rules & calculations

- **Every integration has a kill switch** — a feature flag that turns it off cleanly. Feature-flagged off means the flow either skips the step or falls back to the manual path.
- **Sanctions dry-run endpoint** always runs, even when the feature flag is off. Used by underwriters to spot-check descriptions during onboarding.
- **FX misses are honest.** No 1:1 conversion; null amounts on analytics.
- **PDM cache:** authenticated tokens are cached in a shared cache key to avoid re-authing on every login.
- **Retry policy on outbound webhooks:** three attempts with exponential backoff, dead-letter afterwards.

## Post-MVP integrations

- **Salog (SOAP)** — K+N's legacy shipping system will submit shipments programmatically via a SOAP endpoint that mimics the Salog ShipmentWebService. MVP 2nd phase.
- **China Zurich e-Marine** — second insurer product line integration for the China market.
- **Claims tool integration (LIMs or TIPs)** — vendor decision pending; connects claims logging in this system to the external claims-management platform.

## Related concepts

- Rating
- Login
- Commodity Group Suggestion
- Business Rules
- Webhooks & Event Stream
