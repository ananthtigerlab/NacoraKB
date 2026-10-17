# Work Items

## Where work items live

Active Nacora MGA work is tracked in **Jira filter 12060** in the I2G project. Every ticket cited on this page has key `I2G-XXXXX` and belongs to the MGA build. Filter 12060 is the single source of truth for delivery, testing, and reporting — anyone pulling status should point at it.

The older cross-project filter (`cf[10101] = "Nacora"`) returns **NBMS** tickets — the sister broker system, not the MGA product. NBMS is discussed briefly at the bottom of this page for context, then set aside.

Snapshot: as of 2026-07-03, filter 12060 returns **100 tickets** — 30 in Backlog, 25 in Internal Testing, 29 Verified/Done, 8 in-flight (In Progress / In Dev / Review & Merge / Selected for Development), 2 Confirming, 1 On Hold / To Be Discussed, 5 Bundled/Obsolete.

## Live status

- **Master deployment:** 24 June 2026.
- **Live scope:** KN Poland road logistics only.
- **Live environment:** KN Poland Prod (`nacora-bo.i2go.io`).
- **Sign-off:** received post-KT.
- **Next environment work:** NUAT setup + script-driven Business Partner / Base Rate / Policy Duplication scripts approaching sign-off (I2G-30127 Confirming; I2G-30128 + I2G-30129 in Internal Testing).

## In-flight development (8 tickets)

Working state on a delivery branch or under active development.

**Front-end monitoring**
- **I2G-29583 — Sentry FE integration** (Review & Merge). Sentry monitoring + logging added to `nacora-shipment-portal` (CSP + BO) and `nacora-embedded-cargo` (BO) React apps.

**Special Rates & bulk upload**
- **I2G-29887 — Special Rate BR bypass** (In Progress). Adds three approval-time options: apply all business rules, apply sanctions-related rules only, or always refer. Creates a new system Business Rule ("Special Rate", Referral category) when Always Refer is chosen.
- **I2G-29910 — Special Rate BR bypass, BE** (Internal Testing). Backend side of I2G-29887.
- **I2G-29868 — Bulk Upload Special Rate** (In Progress). Adds an Import button on Policy 360 for Special Rate bulk upload.
- **I2G-30080 — API endpoint for Special Rate bulk upload** (In Dev). Backend for I2G-29868 — secure endpoint, validation, workflow triggering, bi-directional route support.

**Sanctions & compliance**
- **I2G-29735 — Cargo Description Sanction Screening** (In Progress). Bedrock-hosted Cohere-family model scans cargo descriptions; match → referral (not decline).
- **I2G-29736 — Cargo description sanction scanner implementation** (Internal Testing). Child of I2G-29735.

**Commodity classification**
- **I2G-29747 — Cohere Rerank cross-encoder stage** (In Progress). Adds Cohere Rerank on top of AWS Bedrock vector search for commodity classification; improves accuracy on ambiguous cargo.

**Audit trail**
- **I2G-29766 — Audit Trail sidebar filtering + CSV export** (In Progress). Date-range, action-type filters, person autocomplete, free-text search, event count chip, CSV export. Wider sidebar.

**End-to-end residual**
- **I2G-29569 — UAT E2E residual issues** (Selected for Development). Remaining items from UAT round 1 — QR link redirect for insuring conditions, secondary language default, Named Assured token rendering. Some items already verified per the ticket checklist.

## Internal Testing (25 tickets — awaiting sign-off / QA)

**Rating engine**
- **I2G-29532** — KN Poland policy creation blockers: Base Rater filters in NUAT + currency additions + doc editor save. *(Note: marked Verified in Jira; kept here for the doc-editor save follow-up.)*
- **I2G-29582** — Base Rater sort + filter for rate column.
- **I2G-29826** — Bulk Rate Adjustment for Policy Base Rater + Special Rate (percentage increase/decrease across selected permutations).
- **I2G-29828** — Bulk Rerate for Booked & Quoted shipments from the base rater configuration page. Supports Booked-Never-Referred, Previously Referred (except sanctions), Previously Sanction-Referred, Overridden Premium/Tax filters. Sends endorsement email + updated certificate/quote per shipment.
- **I2G-29933** — Vessel Type BRs updated with confirmed VesselFinder mapping (Combination Carrier > 10y, Container/Vehicles Carrier > 30y, General Cargo > 25y, Other > 15y).
- **I2G-29965** — Max Insurable Limit currency configurable independently of Policy Billing Currency (Core label). Example: GBP-billed policy can hold a EUR authority limit.
- **I2G-30093** — Duplicate validation issue in Route Lookup Table (Europe → Europe & Asia vs Europe → Asia mistakenly flagged as duplicate).
- **I2G-30099** — BR configuration bugs — "Refer Matching Keyword" rule allows activation without value; "Same-Country Shipment Outside Policyholder Country" rule has empty condition.

**Referrals**
- **I2G-29728** — Referral Override bugs: insured value + total premium not reflected on shipment or documents after approval (premium breakdown does show correctly).
- **I2G-30038** — Referral bug after requote: adjustment after approved referral re-triggers referral, but the second referral has no reasons displayed, no new activity log entry, and cannot be approved.

**Clauses**
- **I2G-29616** — BR attachment to newly created Policy Clause versions (BR stays on v1 after v2 published; edit view shows anonymous uuid).
- **I2G-29881** — PDF upload functionality on Clauses creation form. Uploaded PDF shown beside the clause title on the Insuring Conditions page; downloadable; replaceable on new clause version.

**Policy / MTA / duplication**
- **I2G-29546** — MTA drafts not obsoleted when policy is cancelled.
- **I2G-30110** — Policy Duplicate: document templates not activated on duplicated policy — quote/cert falls back to default templates.
- **I2G-30129** — KN Poland policy duplication script for Prod. Creates incomplete policy with replicated form (step 1–5), lookup table, base rater, quote+cert documents, BR configuration, policy-level clauses.

**Shipments**
- **I2G-29871** — Change Survey Agent on Booked / Booked-Endorsed shipments. Update certificate general details, regenerate certificate, resend email.
- **I2G-30154** — Certificate number enhancement + shipment cancellation bug (MC-000001-000095 error in Prod on 24 June).

**Business Partners & scripts**
- **I2G-29556** — Commodity mapping + BP name scripts (Chorzow/Poznan/Warsaw/Wroclaw/Sosnowiec/Pruszkow Overland → Road Logistics). Removes ICC C from Coverages.
- **I2G-30128** — Nacora Austria Base Rates upload scripts (source: Google Sheet).
- **I2G-30127** *(Confirming — nearly Verified)* — Business Partners created via script for UAT / NUAT / PROD. Full org tree: Broker Companies, Sales Units, Producers, Policyholder Companies, Participant Companies, Surveyor BPs.

**FE / UX**
- **I2G-29540** — Large Choices dropdowns: pagination + inline search to prevent timeout on 1000+ record lists (e.g. Named Assured).
- **I2G-30169** — FE Usability & Workflow Enhancements. Nacora AT power-user requests bundled: "All" option in SRR participant selector, "Under Review" → "Awaiting Review", single-value dropdowns collapsed to plain text, "Updated By, latest" column on Referral / SRR / Shipment Search.

**Permissions & data scoping**
- **I2G-29481** — Broker-Level Data Visibility bugs. Broker A can access shipment/SRR/SR data of Broker Company B via direct URL (TC04–TC07); Billing Reports tab not yet visible per-scope.

**Referral / Special Rate custom conditions**
- **I2G-29925** — One-time custom Special Conditions in SRR without full clause metadata. "Add to policy library" toggle — off = combination-only, no metadata required.

**Sub-tasks**
- **I2G-29922** — Define data sources + integration requirements for dashboard metrics (KN shipment data, insured shipments, claims, premium data, customer segmentation, myKN, SALOG).

## Confirming (2 tickets)

- **I2G-29837 — Cluster-Level Clauses Management** (Confirming). Cluster clause library between global and policy; auto-assignment with per-policy opt-out.
- **I2G-30127 — Script-driven BP creation for UAT / NUAT / PROD** (Confirming — see Internal Testing block above).

## On Hold / To Be Discussed (1 ticket)

- **I2G-30018 — Zurich E-Sign Integration** (On Hold). China Zurich e-Marine certificate signature flow. Backend scaffolding exists — eligibility check (currently hardcoded true), auth token fetch, sign endpoint, attachment replacement. Waiting on Nacora + Zurich alignment on eligibility criteria and manual override.

## Verified / Done — MVP shipped (29 tickets)

Grouped by module. Reference for what's already live on Prod.

**Rating engine & currency**
- **I2G-29509** — Incoterms not mandatory on Create Quote.
- **I2G-29510** — Macedonian Denar (MKD) added as currency option.
- **I2G-29511** — Region & Country mapping logic for SRR route permutations. Worldwide / regions / countries with mutual exclusion; Worldwide expands to 250 countries under 1 permutation.
- **I2G-29586** — Reorder commodity fields: description before commodity so LLM query uses description as input.
- **I2G-29727** — Display applicable clauses for SRR permutation based on business rules (view-only on SRR; broker still adds extras).
- **I2G-29825** — Shipment Premium Update: Rate-only or Cargo-Premium-only edit modes; min-premium editable when applicable; "Total Premium" renamed to "Total Cost".
- **I2G-30044** — Lebanese Pound (LBP) added as currency option.

**Referrals & business rules**
- **I2G-29543** — Sanctions Scanner: participant-company sanction flag now triggers rule.
- **I2G-29776** — Referral routing + Max Insurable Limit as system BR + "Insured Value over Max. Insurable Limit %" condition. Group-based assignment across all referral rules; new groups (Nacora Underwriting Senior Expert, Analyst) under Nacora Global.
- **I2G-29831** — User roles + BR permissions for Nacora Underwriting Senior Expert Group + Analyst Group.
- **I2G-29834** — Populate shipment-level clauses on the Clauses tab in Referral Activity (view-only, no edit).

**Policy & cancellations**
- **I2G-29532** — KN Poland policy creation blockers (Base Rater filters + currency additions + doc editor save).
- **I2G-29994** — Cancelled Policy incorrect Transaction Type + spurious renewal draft.

**Documents & certificates**
- **I2G-29832** — Letter of Credit Condition toggle on Shipment form (Rail/Road/Air) with content on Certificate only when filled.
- **I2G-29882** — Certificate access counter surfaced in Back Office (was site-admin only).

**Clauses**
- **I2G-29554** — Clause Selection preserved across Clause Library pagination.
- **I2G-29921** — Disable Cluster-Specific Clause Auto-Assignment + restrict Global Library visibility.

**Business Partners & organisation**
- **I2G-29711** — Script for Nacora IT users (7 IT users under Nacora Global / Nacora IT group).
- **I2G-29838** — Cluster field on Broker Company BP creation form.

**Bulk upload**
- **I2G-29890** — Bulk shipment upload: BE endpoints + Excel processor + template.

**Reporting & analytics**
- **I2G-29590** — Billing Reports: `cargoPremiumInInsuredValueCurrency` added to `billedShipments`.
- **I2G-29713** — Extra columns in Shipment Report (expiry, commodity, coverage, incoterms, clauses breakdown).
- **I2G-29865** — Kinesis Firehose event stream setup on Nacora UAT + PROD (`i2go-prod-event-stream`).

**Audit trail**
- **I2G-29601** — Audit trail bugs / enhancements — Quote/Cert editor activity now shown, Lookup Table activity history button added, action-verb standardisation to created / updated / deleted.

**UX / FE polish**
- **I2G-29595** — User-settings-based number & date formatting in Shipment Portal.

**Design**
- **I2G-29518** — [Design] Marine Cargo SRR permutation optimisation (Worldwide / region / countries picker).
- **I2G-29539** — [Design] Nacora Unified Login Page (BMS + MC).
- **I2G-29718** — [Design] Business Rule + SRR enhancements (assignee dropdown, BR bypass options).
- **I2G-29830** — [Design] Marine Cargo SRR potential clauses view.

## Backlog (30 tickets)

Grouped by module.

**Post-MVP rating & clauses**
- **I2G-29564** — Base Rater bug: updated rating factor name not reflected; cannot delete standalone rating factor.
- **I2G-30093** *(also in Internal Testing)* — see above.
- **I2G-30188** — Hide Cargo Premium when Minimum Premium is applied (display only the applicable premium).

**Post-MVP referrals & BR system rules**
- **I2G-29565** — BR system rule: Refer if inland transit outside policyholder's country. Default off, uneditable condition/action.
- **I2G-29870** — Implementation of the inland-transit referral rule.
- **I2G-29895** — Referral Reason display: +1/+2 sticky pill when multiple reasons.
- **I2G-29988** — Referral assignment to User Groups (any group as assignee, not only individuals).
- **I2G-30081** — GFH Underwriter Referral Routing configuration + future ownership model.
- **I2G-30106** — BR system rule: Auto Refer for No Applicable Clauses Available. Triggers when attached clauses count = 0.
- **I2G-30189** — Question Templates for Referral Actions. Reusable library sourced from the Choices page.

**Post-MVP Special Rates**
- **I2G-29934** — Special Rates: assignment to All / Single / Multiple Participant Companies (multi-select).

**Post-MVP bulk upload & rate ops**
- **I2G-29926** — Bulk Upload Business Rules check + certificate generation on demand. Referred / declined / booked shipments all pass through BR pipeline.

**Post-MVP policy operations**
- **I2G-29688** — Copy policies NUAT → PROD via UI; imported policy stays Incomplete until verified.
- **I2G-30082** — Simplify Policy 360 + Incomplete Policy 360 by removing unused actions (Edit Policy, Import, Create Renewal Draft, Create Activity, Create Email, Add Payment Log, Send Policy Email, Update Payment Method, Create Claim, Edit in Admin Site), tabs (Activities, Claims, Emails, Payment Log, Invoices), and fields (Payment Method, Payable Amount, Total Premium on Incomplete).

**Post-MVP shipments & UX**
- **I2G-30053** — Conveyance filter option on shipment overview (requested by Martina Rose via Trello).
- **I2G-30185** — Persist user preferences on Shipment Listing pages (page size, sorting, filters, column visibility across sessions).

**Post-MVP reporting & dashboards**
- **I2G-29682** — Embed Dashboard — Operational, Financial, Policy Overview tab (child of I2G-29686).
- **I2G-29683** — Embed Dashboard — filtering & search.
- **I2G-29684** — Embed Dashboard — Bulk Upload vs Manually Created identification.
- **I2G-29686** — Embed Dashboard (Epic, parent).
- **I2G-29824** — Auto-generation of shipment export via monthly cronjob (all statuses except draft; runs first of month at 00:00 UTC).
- **I2G-29863** — BI / Commercial Dashboard backlog requirements (parent of I2G-29922).

**Post-MVP exports & general**
- **I2G-30007** — Enable file format selection for BO exports (CSV / Excel) across Table reports, Billing reports, Shipments, Special rates, Audit trail.

**Post-MVP claims**
- **I2G-29911** — Claims implementation sub-task (parent unclear in the dump; likely under a claims epic to be located).

**NUAT / environments (Backlog)**
- **I2G-29492 (High)** — NUAT BP creation issues: Person type Group dropdown error; Participant Company missing Policyholder attribute.
- **I2G-29493 (High)** — NUAT Analytics not viewable on Dashboard (QuickSight not configured).
- **I2G-29502 (High)** — NUAT Rating Engine setup + validation.
- **I2G-29563** — Broker Company dropdown missing values + invalid mappings on Surveyor Group choices.
- **I2G-29589** — NUAT E2E Testing Round 2 (Edit Booked Shipment premium/clauses; Producer role permissions on referral & MTA; participant comment visibility; email link redirects).

**Internal / non-product**
- **I2G-29604** — OT task logging & tracking.
- **I2G-30011** — Daily logs.

## Known blockers / at-risk items

Three tickets sit as a live at-risk cluster; treat as one item in weekly delivery reviews.

- **I2G-30018 — Zurich E-Sign Integration** (On Hold). Awaiting client + Zurich alignment on eligibility criteria and manual override.
- **I2G-30038 — Referral bug after requote** (Internal Testing). Second referral surfaces without reasons, cannot be approved. Blocks clean re-quoted-referral handling.
- **I2G-30099 — BR configuration issues** (Internal Testing). Two BR builder bugs affecting rule integrity.

## Bundled / Obsolete (reference only)

- **I2G-29603** — FE Webpack config update: cached vs fresh build outputs inconsistent, causing intermittent blank-page issues after deploy. Bundled into a wider FE build fix.
- **I2G-29501** — NUAT First Policy Setup Blockers. Split into I2G-29502 and follow-up tickets.
- **I2G-29839** — Add custom Clauses directly from Special Rate. Superseded by I2G-29925 (one-time custom Special Conditions in SRR).
- **I2G-29846** — Add Suggestions Manual Fallback. Superseded.
- **I2G-29937** — BP creation bugs (catch-all). Superseded by targeted BP tickets.

## Environment setup status (2026-07-03)

- **KN Poland Prod** — live since 24 June 2026. Master deploy holding; sign-off received.
- **UAT** — end-to-end testing rounds ongoing. Round-1 residuals under I2G-29569; Round-2 under I2G-29589.
- **NUAT** — script-driven setup in progress. I2G-30127 (BP creation) Confirming; I2G-30128 (Nacora Austria Base Rates), I2G-30129 (KN Poland Policy Duplication) in Internal Testing.
- **Open NUAT blockers** — I2G-29492 (High), I2G-29493 (High), I2G-29502 (High), I2G-29563 (Medium). Sit in Backlog awaiting resource assignment.

## Post-MVP roadmap themes (from KT session + backlog analysis)

Directional themes tracked outside the ticket-key level:

- Bulk upload of policy data (not just shipments).
- Sea, air, rail conveyance activation.
- KN Bulgaria, Croatia, Hungary onboarding under Nacora Austria.
- Full end-to-end claims + external tool integration (LIMs vs TIPs — vendor decision pending client-side).
- SOAP inbound integration for Salog (SALOG deferred to MVP 2nd phase).
- Embed Dashboard three-tab commercial/operational view (I2G-29686 epic).
- Cluster-level clauses full rollout after I2G-29837 confirmation.
- GFH Underwriter policy-level ownership model (I2G-30081).

## NBMS — the sister broker system (NOT the MGA product)

The older Jira filter (`cf[10101] = "Nacora"`) returns tickets from **NBMS** — the Nacora Broker Management System. NBMS is the sister broker-side system covering sales and billing, and it is not what this KB documents. NBMS is called out here because it impacts the same delivery team.

**Scheme & policy management (NBMS)**
- New scheme picker with per-product checkboxes (NBMS-1279).
- Scheme-driven Line-of-Business / Product cascade constraints.
- Full CRUD scheme API is live; gaps around insurer freeze after create, policy_count on API, duplicate action (NBMS-1198).
- Policy clone into a new draft under a chosen scheme, with timeline events (NBMS-1240 to 1243) — **not yet in code**.

**Adjustment cover type reconciliation (NBMS-1191, high priority)**
Policies with an "adjustment" cover collect minimum premium upfront, then reconcile end-of-year based on the insured's actual sum insured / headcount / turnover. **Not implemented today.** Brokers cannot record the updated figure or generate the invoice/credit note. Phase 2 scope on NBMS.

**Endorsements (NBMS-1185 epic)**
- Dedicated Endorsements page (list + detail) planned but not built.
- Effective date editability on DRAFT endorsements — in progress (NBMS-1212 / 1213 / 1214).

**Billing & invoicing on NBMS**
- Gross settlement at scheme level for Austria (NBMS-1270).
- German invoices for Austria AON go-live 17 July 2026 (NBMS-1265).
- Localized customer-facing documents driven by per-customer language preference (NBMS-1277, 1235).
- Cash allocation: one payment settling multiple invoices (NBMS-1237).
- Tax codes surfacing + override (NBMS-1266, 1274, 1275).

**Known critical bug**
- **NBMS-1222 (high):** endorsements on annual-payment policies create a duplicate 2nd billing installment dated 12 months out, past policy expiry.

**Other in-flight NBMS work**
- Manual instalments MVP (NBMS-1229).
- Compliance sanction screen backend (NBMS-1189).
- Party role picker separation (NBMS-1209 to 1211).
- Global search fixes for account name lookup (NBMS-1217, 1218).
- Duplicate account warning modal redesign (NBMS-1197).

## Related concepts

- Open Questions & Risks
- Decisions Log
- Meeting Notes
- Environments
- Release History
- Risk Register
- Onboarding Checklist
- Client Overview
