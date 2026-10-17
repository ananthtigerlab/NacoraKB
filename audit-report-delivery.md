# Delivery Space — Audit & Refresh Report

Working audit of the Delivery space of the Nacora KB.
Space scope: PM / delivery-lead running record of the MGA Embedded Cargo delivery.
Owner: BA on the Nacora MGA delivery.
Date of audit: 2026-07-03.
Authoritative source of truth for MGA work items: **Jira filter 12060** (project I2G, 100 tickets).

---

## 1. Existing pages — classification

Baseline before this pass: 4 pages in `content/delivery/`.

| Existing page | Classification | Gap summary |
|---|---|---|
| `work-items.md` | NEEDS EXPANSION | Solid current-view, but missing ~40 tickets from filter 12060 (Internal Testing bugs, bulk rate operations, referral system rules, script-based env setup, obsolete/bundled records). Should be reorganised by module with every ticket key represented. |
| `decisions-log.md` | NEEDS EXPANSION | Covers 12 decisions well. Missing: BR group assignment + Max Insurable Limit as System BR (I2G-29776), cluster-level clauses future-scope decisions, PDF upload on clauses (I2G-29881), currency independence for Max Insurable Limit (I2G-29965), FX rate + billing currency conversion, VesselFinder vessel-type mapping decisions (I2G-29933), user-role split for BR permissions (I2G-29831), Kinesis Firehose analytics stream (I2G-29865), NUAT/PROD script-driven setup approach (I2G-30127/28/29), Sentry FE monitoring commitment (I2G-29583). Should be dated + cross-linked. |
| `open-questions.md` | NEEDS EXPANSION | Existing 8 KT-flagged limitations and 7 filter-12060 gap questions are good but missing: Kinesis Firehose consumer story, dashboard SLA (I2G-29922), whether BR re-run happens on bulk rerate (I2G-29828), obsolete-ticket lessons (I2G-29839, I2G-29846), cross-space open questions from Product/Technical/Client-Foundation audit reports. |
| `meeting-notes.md` | NEEDS EXPANSION | Three material meetings captured (KT session, GFH referral routing, Special Rate BR options, Bulk Upload BR review). Missing: BR + Max Insurable Limit sync (referenced by I2G-29776 / I2G-29965), Vessel-type mapping confirmation with GFH (I2G-29933), cluster-level clauses workshop (I2G-29837 / I2G-29921), NUAT round-2 E2E test recap (I2G-29589), Nacora AT power-user requests bundling (I2G-30169). |

Assessment: **all four existing pages NEED EXPANSION**. None is inadequate; none is obsolete. No page is missing an entire dimension.

## 2. Recommended new running-record pages

The following are worth adding based on volume and coherence of material:

| New page slug | Purpose | Why now |
|---|---|---|
| `environments.md` | Prod / UAT / NUAT current state, sign-off status, ownership | 6+ tickets around NUAT setup and prod duplication; deserves a single view. |
| `release-history.md` | What shipped when, ticket coverage per release | Master deploy of 24 June 2026 warrants a first entry; ongoing releases can be appended. |
| `risk-register.md` | Explicit risk assessment separate from open-questions | Three risk clusters currently sit inside open-questions; a dedicated register clarifies severity + owner. |
| `onboarding-checklist.md` | Getting a new BA or dev up to speed on the Nacora delivery | Thiva-departure risk; explicit onboarding artefact protects against KT loss. |

Not added:
- **Deployment log** — separate from release-history for internal test / hotfix deploys. Deferred; can be a section under release-history until volume warrants a split.
- **Vendor decision tracker** — Nacora has open vendor picks (LIMs vs TIPs; Zurich alignment; SALOG SOAP). All captured in open-questions with owners; no need for a separate page yet.

Total new pages this pass: **4**.

## 3. Filter 12060 — full ticket inventory (2026-07-03)

Grouped by status. All 100 tickets. Priority is Medium unless flagged (High is called out).

### 3.1 In-flight development (In Progress / In Dev / Review & Merge / Selected for Development — 8 tickets)

| Key | Type | Assignee | Summary | Delivery notes |
|---|---|---|---|---|
| I2G-29735 | Story | Taher Alkamel | Cargo Description Sanction Screening | Bedrock/Cohere free-text scan → referral outcome. |
| I2G-29747 | Story | Taher Alkamel | Commodity suggestion — Cohere Rerank cross-encoder | Improves ambiguous cargo classification. |
| I2G-29766 | Story | Taher Alkamel | Audit Trail sidebar — filtering + CSV export | Filters, event count chip, wider sidebar. |
| I2G-29868 | Story | AJAYKUMAR GOLI | Bulk Upload Special Rate — Policy 360 Import button | FE side of Special Rate bulk upload. |
| I2G-29887 | Story | Oliver Gading Jinggan | Special Rate BR bypass (three approval-time options) | See Decisions Log. |
| I2G-30080 | Sub-task | AJAYKUMAR GOLI | API endpoint for Special Rate bulk upload | Backend for I2G-29868. |
| I2G-29583 | Task | Taher Alkamel | Sentry FE integration for `nacora-shipment-portal` + `nacora-embedded-cargo` | Review & Merge status. |
| I2G-29569 | Bug | Unassigned | UAT E2E round-1 residual issues — Quote/Cert QR + Named Assured tokens + secondary-language default + BR misfires | Selected for Development. Some items already verified per checklist. |

### 3.2 Internal Testing (25 tickets — awaiting sign-off or in QA)

| Key | Type | Assignee | Summary |
|---|---|---|---|
| I2G-29481 | Bug | Oliver Gading Jinggan | Broker-Level Data Visibility Bugs (TC04–07: shipment/SRR/SR/billing scoping) |
| I2G-29540 | Task | Ammar Al-Thari | Large Choices dropdowns — pagination + inline search to prevent timeout |
| I2G-29546 | Bug | Oliver Gading Jinggan | MTA Drafts not obsoleted when policy is cancelled (TC12) |
| I2G-29556 | Task | Ammar Al-Thari | Update Commodity Mapping + BP naming scripts (Overland → Road Logistics rename, ICC C removed from Coverages) |
| I2G-29582 | Task | Ammar Al-Thari | Base Rater — sort + filter for rate column |
| I2G-29616 | Bug | Ammar Al-Thari | Business Rule attachment to newly-created Policy Clause versions (BR stays on v1 after v2 published) |
| I2G-29728 | Bug | Lazarus Tanaka Mtake | Referral Override — insured value + total premium not reflected on shipment / documents after approval |
| I2G-29736 | Sub-task | Taher Alkamel | Cargo description sanction scanner implementation (child of I2G-29735) |
| I2G-29826 | Task | Oliver Gading Jinggan | Bulk Rate Adjustment for Base Rater + Special Rate (percentage increase/decrease) |
| I2G-29828 | Task | Muhamad Amirul Aiman | Bulk Rerate for Booked & Quoted shipments (from base rater config page) |
| I2G-29871 | Task | Ammar Al-Thari | Change Survey Agent on Booked / Booked-Endorsed shipments — update certificate + resend email |
| I2G-29881 | Task | Thayananth Kumaresan | PDF upload functionality on Clauses creation form |
| I2G-29910 | Sub-task | Oliver Gading Jinggan | BE — Special Rate BR bypass (child of I2G-29887) |
| I2G-29922 | Sub-task | Ammar Al-Thari | Define data sources + integration requirements for dashboard metrics |
| I2G-29925 | Task | Ammar Al-Thari | One-time custom Special Conditions in SRR without full clause metadata (see Decisions Log) |
| I2G-29933 | Task | Ammar Al-Thari | Vessel Type BRs updated with confirmed VesselFinder mapping (Combination Carrier, Container/Vehicles Carrier, General Cargo, Other) |
| I2G-29965 | Task | Ammar Al-Thari | Max Insurable Limit currency configurable independently of Policy Billing Currency (Core label) |
| I2G-30038 | Bug | Lazarus Tanaka Mtake | Referral bug after requote (see at-risk cluster) |
| I2G-30093 | Bug | Oliver Gading Jinggan | Duplicate validation issue in Route Lookup Table (Europe → Europe & Asia vs Europe → Asia) |
| I2G-30099 | Bug | Ammar Al-Thari | BR configuration bugs — Refer Matching Keyword rule allows activation without value; Same-Country Shipment Outside Policyholder Country rule has empty condition |
| I2G-30110 | Bug | Lazarus Tanaka Mtake | Policy Duplicate — document templates not activated on duplicated policy |
| I2G-30128 | Task | Ammar Al-Thari | Nacora Austria Base Rates upload scripts |
| I2G-30129 | Task | Ammar Al-Thari | KN Poland policy duplication script for Prod |
| I2G-30154 | Task | Lazarus Tanaka Mtake | Certificate number enhancement + Shipment view/cancellation bug (MC-000001-000095 error) |
| I2G-30169 | Task | Ammar Al-Thari | FE Usability & Workflow Enhancements — SRR "All" participant selector, "Awaiting Review" label, single-value dropdowns, "Updated By, latest" column |

### 3.3 Confirming (2 tickets)

| Key | Type | Assignee | Summary |
|---|---|---|---|
| I2G-29837 | Story | Ammar Al-Thari | Cluster-Level Clauses Management (auto-assignment + per-policy opt-out) |
| I2G-30127 | Story | Ammar Al-Thari | Create Business Partners via script for UAT / NUAT / PROD (Broker Companies, Sales Units, Producers, Policyholders, Participant Companies, Surveyor BPs) |

### 3.4 Verified / Done (29 tickets — shipped in MVP)

| Key | Type | Assignee | Summary |
|---|---|---|---|
| I2G-29509 | Task | Oliver Gading Jinggan | Incoterms not mandatory |
| I2G-29510 | Task | Oliver Gading Jinggan | Add Macedonian Denar (MKD) currency option |
| I2G-29511 | Story | Thiva | Region & Country mapping logic for SRR route permutations |
| I2G-29518 | Story | Andrea Christella Andrew | [Design] Marine Cargo SRR permutation optimisation |
| I2G-29532 | Bug | Thiva | KN Poland policy creation blockers (base-rater filters + currency additions + doc editor save) |
| I2G-29539 | Story | Andrea Christella Andrew | [Design] Nacora Unified Login Page |
| I2G-29543 | Bug | Ammar Al-Thari | Sanctions Scanner — participant-company sanction flag not triggering rule |
| I2G-29554 | Bug | Oliver Gading Jinggan | Clause Selection cleared on pagination in Clause Library modal |
| I2G-29586 | Task | Ammar Al-Thari | Reorder commodity fields — description before commodity field on shipment form |
| I2G-29590 | Task | Oliver Gading Jinggan | Billing Reports — add cargoPremiumInInsuredValueCurrency to billed shipments |
| I2G-29595 | Sub-task | Oliver Gading Jinggan | User-settings based number & date formatting in Shipment Portal |
| I2G-29601 | Bug | Oliver Gading Jinggan | Audit trail bugs / enhancements (Quote/Cert editor activity, Lookup Table activity history, action-verb standardisation) |
| I2G-29711 | Task | Ammar Al-Thari | Script for Nacora IT users (Jens Weir, Frank-Fabian Hagemann, Julia Wagner, Martina Rose, Harry Mulalet, Shan Huang, Carolina Kelner) |
| I2G-29713 | Task | Oliver Gading Jinggan | Extra columns in Shipment Report (expiry, commodity, coverage, incoterms, clauses breakdown) |
| I2G-29718 | Story | Andrea Christella Andrew | [Design] Business Rule + SRR enhancements |
| I2G-29727 | Task | Oliver Gading Jinggan | Display applicable clauses for SRR permutation based on business rules (view-only) |
| I2G-29776 | Story | Thiva | BR — group-based referral routing + Max Insurable Limit as system BR + policy-limit-threshold condition |
| I2G-29825 | Task | Oliver Gading Jinggan | Shipment Premium Update — Rate vs Cargo Premium edit modes, Total Cost rename |
| I2G-29830 | Story | Andrea Christella Andrew | [Design] Marine Cargo SRR potential clauses |
| I2G-29831 | Sub-task | Oliver Gading Jinggan | User roles + BR permissions — Nacora Underwriting Senior Expert Group + Analyst Group |
| I2G-29832 | Task | Oliver Gading Jinggan | Letter of Credit Condition toggle on Shipment form (see Decisions Log) |
| I2G-29834 | Task | Oliver Gading Jinggan | Populate shipment-level clauses on Clauses tab in Referral activity (view-only) |
| I2G-29838 | Task | Oliver Gading Jinggan | Cluster field on Broker Company BP form |
| I2G-29865 | Task | Syazani Raya | Kinesis Firehose setup on Nacora UAT + PROD (event stream) |
| I2G-29882 | Task | Oliver Gading Jinggan | Certificate access counter surfaced in BO (was site-admin only) |
| I2G-29890 | Sub-task | AJAYKUMAR GOLI | Bulk shipment upload — BE endpoints + Excel processor |
| I2G-29921 | Task | Oliver Gading Jinggan | Disable Cluster-Specific Clause Auto-Assignment + restrict Global Library visibility |
| I2G-29994 | Bug | Oliver Gading Jinggan | Cancelled policy showing incorrect Transaction Type + creating renewal draft |
| I2G-30044 | Task | Oliver Gading Jinggan | Add Lebanese Pound (LBP) currency option |

### 3.5 Backlog (30 tickets)

| Key | Type | Assignee | Summary |
|---|---|---|---|
| I2G-29492 | Bug (High) | Unassigned | NUAT BP creation issues (Person type Group dropdown error; Participant Company missing Policyholder attribute) |
| I2G-29493 | Bug (High) | Unassigned | NUAT — Analytics not viewable on Dashboard/Home (QuickSight not configured) |
| I2G-29502 | Task (High) | Ammar Al-Thari | NUAT — Rating Engine setup + validation |
| I2G-29563 | Bug | Unassigned | Broker Company dropdown — missing values + invalid mappings on Surveyor Group choices |
| I2G-29564 | Bug | Unassigned | Base Rater — updated rating factor name not reflected; cannot delete standalone rating factor |
| I2G-29565 | Story | Unassigned | BR system rule — Refer if inland transit outside policyholder's country |
| I2G-29589 | Bug | Unassigned | NUAT E2E Testing Round 2 (Edit Booked Shipment premium/clauses; Named Assured error; Producer role permissions on referral & MTA; participant comments visibility) |
| I2G-29604 | To-Do | Unassigned | OT task logging & tracking (internal) |
| I2G-29682 | Story | Unassigned | Embed Dashboard — Operational, Financial, Policy Overview tab |
| I2G-29683 | Story | Unassigned | Embed Dashboard — filtering & search |
| I2G-29684 | Story | Unassigned | Embed Dashboard — Bulk Upload vs Manually Created identification |
| I2G-29686 | Epic | Unassigned | Embed Dashboard (parent) |
| I2G-29688 | Story | Unassigned | Copying policies from one env to another (NUAT → PROD, incomplete state) |
| I2G-29824 | Story | Lazarus Tanaka Mtake | Auto-generation of shipment export via monthly cronjob |
| I2G-29863 | Story | Unassigned | BI / Commercial Dashboard backlog requirements |
| I2G-29870 | Task | Unassigned | Referral for inland transit outside policyholder's country (implementation of I2G-29565) |
| I2G-29895 | Task | Unassigned | Referral Reason display — +1/+2 pill for multiple reasons on referral list |
| I2G-29911 | Sub-task | Taher Alkamel | Add claims implementation (parent unclear) |
| I2G-29926 | Story | AJAYKUMAR GOLI | Bulk Upload Business Rules check + certificate generation on demand |
| I2G-29934 | Task | Unassigned | Special Rates — Assignment to All / Single / Multiple Participant Companies |
| I2G-29988 | Task | Unassigned | Referral — allow assignment to User Groups |
| I2G-30007 | Task | Unassigned | Enable file format selection for BO exports (CSV / Excel) |
| I2G-30011 | To-Do | Unassigned | Daily logs (internal) |
| I2G-30053 | Task | Unassigned | Add conveyance filter option on shipment overview |
| I2G-30081 | Story | Unassigned | GFH Underwriter Referral Routing configuration + future ownership model |
| I2G-30082 | Story | Unassigned | Simplify Policy 360 + Incomplete Policy 360 by removing unused actions/tabs/fields |
| I2G-30106 | Story | Lazarus Tanaka Mtake | BR system rule — Auto Refer for No Applicable Clauses Available |
| I2G-30185 | Task | Muhamad Amirul Aiman | Persist user preferences on Shipment Listing pages (page size, sorting, filters, columns) |
| I2G-30188 | Task | Muhamad Amirul Aiman | Hide Cargo Premium when Minimum Premium is applied |
| I2G-30189 | Task | Unassigned | Question Templates for Referral Actions (Choices-page-driven library) |

### 3.6 On Hold / To Be Discussed (1 ticket)

| Key | Type | Assignee | Summary |
|---|---|---|---|
| I2G-30018 | Sub-task | Dhariya Sreedharan | Zurich E-Sign Integration (China Zurich e-Marine flow) |

### 3.7 Bundled / Obsolete (5 tickets — mentioned for completeness)

| Key | Status | Summary | Note |
|---|---|---|---|
| I2G-29603 | Bundled | FE Webpack config update — inconsistent build outputs with cache | Bundled into wider FE build fix. |
| I2G-29501 | Obsolete | NUAT — First Policy Setup Blockers | Split into I2G-29502 + follow-up tickets. |
| I2G-29839 | Obsolete | Add custom Clauses directly from Special Rate | Superseded by I2G-29925 (one-time custom Special Conditions in SRR). |
| I2G-29846 | Obsolete | Add Suggestions Manual Fallback | Superseded. |
| I2G-29937 | Obsolete | BP creations bugs | Superseded — covered by other BP tickets. |

## 4. Modules / themes across the ticket set

- **Rating engine** — I2G-29502, 29532, 29556, 29564, 29582, 29586, 29727, 29825, 29826, 29828, 29881, 29933, 29965, 30044, 30093, 30099, 30188. Both configuration bugs and enhancements (bulk adjustments, rerating, currency handling, VesselFinder).
- **Referrals** — I2G-29565, 29728, 29776, 29831, 29834, 29870, 29887, 29895, 29910, 29988, 30038, 30081, 30106, 30169, 30189. Group routing, system BRs, question templates, override bugs.
- **Special Rates & SRR** — I2G-29511, 29518, 29727, 29830, 29868, 29887, 29910, 29925, 29934, 30080, 30169. Bulk upload, participant-company assignment options, BR bypass, potential clauses, custom conditions.
- **Clauses** — I2G-29554, 29616, 29727, 29834, 29837, 29881, 29921, 29925, 30106, 30110. Global vs cluster vs policy libraries, PDF upload, business-rule linkage, system rule for no-clause referral.
- **Bulk Upload** — I2G-29684, 29826, 29828, 29868, 29890, 29926, 30080. Shipment + special rate + rate adjustment + BR revalidation.
- **Business Partners** — I2G-29492, 29556, 29563, 29711, 29838, 29871, 29937, 30127. Scripts, creation bugs, cluster field, survey agent.
- **Sanctions & Compliance** — I2G-29543, 29735, 29736, 29910. Sanctions scanner + cargo description scan + Bedrock/Cohere models.
- **Documents & Certificates** — I2G-29594, 29832, 29882, 30110, 30154. Toggle fields, access counter, template preservation across duplication, certificate number enhancement.
- **Reporting & Analytics** — I2G-29493, 29590, 29682, 29683, 29684, 29686, 29713, 29824, 29863, 29865, 29922. Embed Dashboard epic, Kinesis Firehose, billing report enhancements, shipment cronjob export.
- **Environments & Scripts** — I2G-29493, 29502, 29556, 29569, 29589, 29688, 29711, 30127, 30128, 30129. NUAT setup, script-driven population, cross-env policy copying.
- **Policy management** — I2G-29532, 29546, 29994, 30082, 30110. Cancellation, transaction type, duplication, screen simplification.
- **Audit Trail & Activity** — I2G-29601, 29766. Bugs + filtering + CSV export.
- **User & Permissions** — I2G-29481, 29589, 29831. Broker-level data scoping, role setup, permission errors.
- **UX / General FE polish** — I2G-29540, 29554, 29595, 30053, 30169, 30185. Large-list dropdowns, pagination memory, conveyance filter, preference persistence.
- **Integration** — I2G-29583 (Sentry), I2G-29865 (Kinesis Firehose), I2G-30018 (Zurich e-sign).

## 5. Decisions to add to the log

Beyond the 12 decisions already recorded, the following should be added chronologically (newest first):

- 2026-07 — VesselFinder vessel-type mapping confirmed by GFH; BRs updated to use it (I2G-29933).
- 2026-07 — Nacora AT power-user requests bundled into a single FE usability sprint (I2G-30169).
- 2026-06 — Max Insurable Limit is now a system Business Rule (moved from policy billing step), configurable value only (I2G-29776).
- 2026-06 — Max Insurable Limit currency is decoupled from Policy Billing Currency; can be configured independently (I2G-29965).
- 2026-06 — Referral group assignment supported for GFH + Nacora Underwriting Senior Expert + Analyst groups; default to lead insurance group (I2G-29776).
- 2026-06 — Policy limit threshold condition "Insured Value over Max. Insurable Limit %" added to BR builder (I2G-29776).
- 2026-06 — Nacora Underwriting Senior Expert Group + Analyst Group added under Nacora Global (I2G-29776, I2G-29831).
- 2026-06 — Sentry monitoring adopted for `nacora-shipment-portal` (CSP & BO) and `nacora-embedded-cargo` (BO) FE apps (I2G-29583).
- 2026-06 — Kinesis Firehose event stream set up on Nacora UAT + PROD (I2G-29865).
- 2026-06 — PDF upload for Clauses creation form (I2G-29881).
- 2026-06 — Certificate access counter surfaced in Back Office (I2G-29882).
- 2026-06 — Applicable clauses for SRR permutation are view-only on SRR; broker still adds extra clauses on top (I2G-29727).
- 2026-06 — Shipment Premium Update: user picks Rate-only or Cargo-Premium-only editing mode; "Total Premium" renamed to "Total Cost" (I2G-29825).
- 2026-06 — Prod setup is script-driven not manual — separate scripts for Business Partners, Base Rates, Policy Duplication (I2G-30127, I2G-30128, I2G-30129).
- 2026-05 — SRR route selection supports Worldwide / Regions / Countries with mutual exclusion; Worldwide expands to 250 countries under 1 permutation (I2G-29511, I2G-29518).
- 2026-04 — Commodity field ordering: description before commodity so LLM query uses the description as input (I2G-29586).

## 6. Cross-space open questions to fold in

From `audit-report-client-foundation.md`:
- Which insurer is authorised for which Nacora Broker Company (GFH vs Allianz Global Risks US) needs an explicit mapping table for the audit.
- Cluster & regional structure: interaction between the cluster field on Broker Company BP (I2G-29838) and the Cluster Clauses layer (I2G-29837) needs Nacora sign-off on the resolution rule when a Broker Company is not assigned a cluster.

From `audit-report-technical.md`:
- Which environments will run pgvector-backed semantic search once PGlite supports the extension (Technical roadmap deferred item).
- Whether the Django admin surface (`/tiger-site-admin/`) is exposed in Nacora Prod or hidden — impacts operational access.
- Sanctions list feed authority — OFAC via AWS Comprehend fallback to OFAC SDN JSON; refresh cadence and who owns escalation on feed failure.

## 7. Page-refresh plan

Files to write in this pass:

1. `content/delivery/work-items.md` — full reorganisation. Statuses reflect filter 12060 as of 2026-07-03. Grouped by module with every ticket key represented. NBMS section trimmed (kept for context only).
2. `content/delivery/decisions-log.md` — append the 15 additional decisions above at appropriate dates.
3. `content/delivery/open-questions.md` — add cross-space open questions from Product/Technical/Client-Foundation audits, plus dashboard SLA + Kinesis consumer story + bulk rerate BR question.
4. `content/delivery/meeting-notes.md` — append the referenced Vessel-type mapping sync + Cluster-Level Clauses workshop + FE usability bundling notes + NUAT round-2 recap where dates are known.
5. `content/delivery/environments.md` — new page.
6. `content/delivery/release-history.md` — new page.
7. `content/delivery/risk-register.md` — new page.
8. `content/delivery/onboarding-checklist.md` — new page.

Total: **4 refreshed pages + 4 new pages = 8 files**.

---

*(End-of-pass summary added below after all pages have been written.)*
