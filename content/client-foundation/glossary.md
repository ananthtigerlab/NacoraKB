# Glossary

## What it is

The comprehensive glossary of terms used across NacoraHub. Every term below is either an official label from the Nacora documentation or a Nacora-specific concept captured from client sessions. Entries are alphabetical. Use the labels here exactly as written — do not coin alternatives such as "broker user", "customer portal", or "back-office user".

## Canonical names to use exactly

Some concepts have canonical labels that should be used verbatim in any new documentation or conversation:

- The platform that hosts cargo insurance is **NacoraHub**.
- The participant-facing interface is **Shipment Portal**.
- The internal interface is **Back-Office (NacoraHub)**, shorthand **Back Office**.
- The role that submits and manages shipments is **Participant**.
- The role that designs and manages policies is **Producer / Broker**.
- The role that resolves referrals and approves rates is **Underwriter**.
- The role that maintains master data and the system foundation is **Administrator** (scoped variants: **Company Admin**, **Organisation Admin**).
- The party recorded as insured on a shipment is **Named Assured**.
- A non-standard rate is a **Special Rate**; the request is a **Special Rate Request** (SRR).
- A change to a booked shipment is **Amend Shipment**, which creates an endorsed shipment.
- A change to an active policy is an **MTA** (Mid-Term Adjustment).

## Terms

**Admin Group** — a Group Business Partner that bundles administrators. Used to grant admin permissions at the group level.

**Administrator** — a Person Business Partner with access to admin pages, including the pending-approvals queue and master-data management. Scoped variants exist: Company Admin (scoped to one Broker Company) and Org Admin (scoped to one Insurance Group).

**Amend Shipment** — the participant-facing action for endorsing a booked shipment. Same underlying flow as shipment endorsement; creates a new endorsement record while keeping the original booking on record.

**Back-Office (NacoraHub)** — the internal interface used by brokers, underwriters, and administrators. Brokers configure policies, manage referrals, and run shipment operations. Underwriters review referrals and special-rate requests. Administrators maintain business partners, choices, the global clauses library, and exchange rates. Sometimes referred to as the "Backoffice" or the internal-user portal.

**Base Rater** — Nacora's rating catalogue, versioned. Every policy is tied to a specific Base Rater version.

**Bill-to-Party** — the entity that receives commission statements and reconciliation reports. In current deliveries, the same entity as the Policyholder.

**BMS (NBMS)** — the sister broker system (Nacora Broker Management System). Separate from NacoraHub; handles client billing, invoicing, and commissions. Refund calculations and reconciliation happen there, not in NacoraHub.

**Book** — commit to a quote; moves a shipment from Quoted to Booked. Locks the premium, generates the certificate, and puts cover in force.

**Booked** — a shipment status. Coverage has been confirmed and is in force. The certificate has been issued.

**Booked – Endorsed** — a booked shipment that has been amended by endorsement after booking. Coverage remains in force with the updated values.

**Booked – Endorsed – Under Review** — a Booked – Endorsed shipment currently being edited by the Back Office (typically premium or clauses). Locked from the participant until Publish Changes runs.

**Booked – Pending Cancellation Approval** — a Booked shipment whose cancellation has been requested by the participant. Coverage continues until the Back Office approves or rejects. Often referred to as "Pending Cancellation".

**Booked – Under Review** — a Booked shipment being edited by the Back Office (typically premium or clauses). Locked from the participant until Publish Changes runs.

**Bordereau (Billing Report)** — a periodic report to the insurer listing every shipment booked in the period, with premium, commission, and net amounts. Generated per policy configuration. Emitted from the MGA side monthly; ingested by BMS for customer billing and commission reconciliation.

**Bill-to-Party** — the entity that receives the customer invoices. Same as the Policyholder in current Nacora deliveries. Belongs to the BMS side of the two-system architecture, not the MGA side.

**BMS side** — the broker-management (client billing / commissions) half of Nacora's two-system architecture. Sister system to NacoraHub Cargo. Not documented in this KB.

**Broker Company** — a Business Partner of category Company that intermediates between the insured and the insurer. A policy is always tied to a Broker Company in NacoraHub. Regional entities, for example Nacora Austria. Owns the master contract with the insurer.

**Broker side vs MGA side** — Nacora runs both. The broker side handles client relations and billing; it runs on the separate broker system. The MGA side — NacoraHub itself — handles underwriting, rating, quote and book, referrals, and claims logging.

**Business Rule** — a conditional pricing or behaviour rule on a policy version. Each rule has conditions (combined with ALL or ANY logic) and one or more actions (premium adjustments, overrides, referral triggers, decline triggers).

**Cancelled** — a terminal shipment status. Coverage has been terminated, either by direct Back Office cancel or by an approved participant cancellation request.

**Certificate** — the PDF document used as proof of cover for a booked shipment. Edited via the Document Editor. Re-issued on every endorsement or Back Office premium change; previous versions stay on the Documents tab.

**Choices** — the dropdown values and lookup tables used throughout NacoraHub, including currencies, commodity groups, country lists, and rating parameters.

**Cluster** — a regional or business grouping that sits between the global setup and the individual policy. Examples: EMEA-North, APAC, LATAM-South. Drives regional clause libraries, referral routing, and data-visibility scoping. Broker Companies belong to a cluster; policies inherit the cluster context.

**Co-insurance** — a policy underwritten by more than one insurer, each with a percentage share. Up to three insurers per policy; shares must total 100%; exactly one insurer is Lead.

**Clause** — a piece of insurance wording attached to a policy or shipment. Clauses can be Global (drawn from the library) or Policy-specific. Any clause added at the shipment level can be marked as a Special Condition; it then appears in a distinct section of the certificate below the standard Insuring Conditions.

**Commodity Group** — the classification of the cargo being shipped (Consumer Electronics, Frozen Food, Pharmaceuticals, Beverages, Antique Art, Animals, and so on). Used both for eligibility and for rating. Suggested by AI from free-text on the declaration form.

**Conveyance** — the mode of transport: Air, Sea, Road, or Rail. The MVP live scope is Poland Road only; other conveyances are configured but not yet activated.

**Cost Centre (CC)** — a regional or organisational unit. Each Participant Company in NacoraHub is mapped to a cost centre. New users are placed in a cost centre during the pending-approvals flow.

**currencyapi.com** — the FX rate provider. Syncs daily at midnight; shipments quote at the previous day's rate.

**Draft** — a shipment status. The shipment has been saved but no premium has been calculated and no quote has been issued.

**e-Marine** — China Zurich's marine insurance platform. Integration is planned for a later phase, focused on the China market.

**Embedded Cargo** — the delivery model: cargo insurance offered as an add-on inside K+N's core shipping workflow, rather than as a stand-alone retail insurance product.

**Embargoed country** — a country whose national jurisdiction is subject to comprehensive sanctions. Current list in the platform: North Korea, Iran, Syria. Shipments with either origin or destination on the list are referred (not declined) so a human can review. Transit through an embargoed country is not detected today.

**EMEA-North / APAC / LATAM-South** — example cluster names in the deployment. Regional groupings that drive cluster-scope configuration.

**Embedded Cargo Policy Wizard** — the guided form that producers and product managers use to configure a cargo policy end-to-end: parties, billing, risks, clauses, business rules, and document templates.

**Endorsement** — a controlled change to a shipment after it has been booked. Preserves history — the original booking stays on record while the new values take effect. Distinct from an MTA, which changes a policy. Sometimes called Amend Shipment in the participant-facing action.

**Endorsement Note** — the free-text justification recorded when creating an MTA. Mandatory.

**Expired** — a terminal shipment status. The policy end date passed while this shipment was in force. System-triggered.

**GeoRisk** — a geographic risk-scoring service. Booked shipments are posted via webhook for enrichment.

**GFH (GFH Underwriting Agency LTD)** — Kuehne+Nagel's captive underwriting agency. Underwrites KN policies. GFH sits on one side of the insurer split; Allianz Global Risks US sits on the other for third-party policies.

**Google Maps API** — used for departure and destination address autocomplete on the declaration form. Ensures the addresses that go onto certificates are real, resolvable locations.

**i2go** — the TigerLab platform brand name; the NacoraHub portal domains inherit from it.

**IACS (International Association of Classification Societies)** — the international body that classifies commercial vessels. Nacora's business rules refer shipments on non-IACS vessels. Currently latent because MVP is road only.

**ICC A / B / C** — the standard Institute Cargo Clauses. A is broadest ("all risks"); B is named perils; C is the narrowest (catastrophic perils only).

**Incomplete Policy** — a draft policy not yet activated. Used as the intermediate state during policy duplication.

**Insurance Company / Insurer** — the carrier underwriting the policy. Multiple insurers can share a single policy (co-insurance); one is designated as the Lead Insurer. In current Nacora deliveries: GFH for KN policies, Allianz Global Risks US for third-party policies.

**Insurance Group** — a Group Business Partner that bundles underwriters under one Insurance Company. Determines the underwriting team that owns a policy.

**Insured Value** — the declared value of cargo on a shipment. Capped by the policy's Maximum Insurable Limit per Shipment. Declared in a currency drawn from the policy's billing settings.

**Insuring Conditions** — the legal text on the certificate explaining what is and isn't covered. Distinct from Special Conditions, which appear separately.

**KN (Kuehne+Nagel)** — the global logistics group that owns Nacora. Headquartered in Switzerland. K+N is both the parent group and the primary customer of the MGA delivery.

**KN Austria** — see Nacora Austria — the Broker Company entity for the MVP delivery, parent for KN Poland and (in future) KN Bulgaria / Croatia / Hungary.

**KN Bulgaria / Croatia / Hungary** — the next K+N regional entities in the expansion roadmap. Under Nacora Austria as parent Broker Company. Not live in MVP.

**KN Poland** — the Policyholder for the MVP delivery. Nine Road Logistics Participant Companies underneath. Roughly 14% of Nacora's net turnover.

**KN Policy** — a cargo policy where Kuehne+Nagel itself is the insured. Underwritten through GFH Underwriting Agency LTD (KN's captive underwriting agency). KN Policies sit alongside Third Party policies in Nacora's portfolio but follow KN-specific configuration.

**Lapsed** — a terminal shipment status. The underlying policy lapsed while this shipment was in force. System-triggered.

**Lead Insurer** — the designated lead among co-insurers on a policy. In current deliveries, the insurer with the largest share (up to three insurers can total 100%). Exactly one insurer must be marked as lead.

**LIMs** — one candidate external claims management tool (vendor decision pending post-MVP).

**Max Insurable Limit** — the per-shipment cap on insured value, configured on the policy's billing step. Declaring above the cap does not fail the form; it triggers a referral.

**MGA (Managing General Agent)** — an intermediary authorised to underwrite, price, and administer insurance policies on behalf of an insurer. Nacora acts as an MGA between K+N (the customer) and the insurers (GFH or Allianz).

**MTA (Mid-Term Adjustment)** — a change to an active policy. The user-facing action is Endorse Policy, found in the three-dot Actions menu on the policy detail page. The MTA wizard opens with an extra MTA Details step where the Endorsement Note and Effective Date are recorded; broker, policyholder, dates, and policy type are locked. Distinct from a shipment-level endorsement.

**Nacora** — the brokerage + MGA company that runs this platform. Owned by Kuehne+Nagel. Nacora brokers cargo insurance both for KN's own business (see KN Policy) and for other clients (see Third Party). Two commercial roles: broker (BMS side) and Managing General Agent (this platform).

**Nacora Austria** — the Broker Company (Nacora regional entity) that owns the master policy contract for the MVP delivery. Parent to KN Poland at go-live; will parent KN Bulgaria, Croatia, and Hungary in later phases.

**NacoraHub** — the platform that hosts Nacora's cargo insurance operations end-to-end. Comprises the Shipment Portal (for participants) and the Back-Office (for brokers, underwriters, and administrators).

**Named Assured** — has two related but distinct meanings; always check the context. On a policy (Participant Company flag): a checkbox on each Participant Company row indicating that the participant is explicitly listed as insured on the policy. Only meaningful — and only visible — for third-party policy types. Managed at policy-setup time; changes apply going forward. On a shipment: the party named as the assured on a specific shipment, captured on the declaration form and picked from a dropdown or created inline. This is who is insured for this specific cargo movement and stays attached to the shipment for its lifetime; it does not have to be one of the policy-level Named Assureds. In short: the policy flag governs who can be the assured; the shipment value records who actually was the assured for this movement.

**Named Insured** — used interchangeably with Named Assured in some client sessions, particularly when referring to who a Special Rate applies to.

**Open Cover** — the umbrella agreement between Nacora and the insurer. For KN policies, renews annually and automatically. For third-party policies, requires an explicit renewal decision.

**Open Marine Cargo** — the MVP product. Cargo insurance for goods in transit by air, sea, road, or rail.

**OP Tree** — organisational / permission tree. The Broker → Policyholder → Participant hierarchy that enforces multi-tenant data isolation.

**Packing** — how the cargo is packed (Professionally Packed, Unpacked, and so on). A rating dimension.

**Participant** — a Person Business Partner at a Participant Company who can create, quote, book, endorse, and cancel shipments via the Shipment Portal.

**Participant Company** — a company that shares (or operates under) the same policy as the policyholder. Typically a branch, subsidiary, or affiliated entity. In Nacora deliveries these are Kuehne+Nagel regional logistics teams or external freight forwarders attached to a Policyholder. Their staff submit shipments via the Shipment Portal.

**Participant Group** — a Group Business Partner that bundles participants under a Participant Company. Used to grant Shipment Portal permissions at the group level.

**PDM (Participant Data Management / Person Data Master)** — the upstream Kuehne+Nagel HR / directory system NacoraHub consults to confirm a user's identity and cost-centre eligibility. The mapping between PDM identifiers and Nacora cost centres is maintained by the Nacora administrator.

**Pending Approval** — two related uses. For Business Partners: the status of a Person BP after single sign-on but before an administrator has placed them in a cost centre. For Special Rate Requests: the status of a request after submission and before Back Office approval or decline.

**Pending Cancellation** — see Booked – Pending Cancellation Approval.

**Policy** — the umbrella contract under which shipments are quoted and booked. Configured via the Embedded Cargo Policy Wizard.

**Policy Version** — a specific revision of a policy. Mid-term amendments (MTA) create a new policy version while preserving history.

**Policyholder** — the Business Partner that owns a policy and is the primary insured party. Selected on the policy's General Details step. In Nacora deliveries, a K+N regional entity that is also Bill-to-Party.

**Producer** — a Person Business Partner with permission to create and manage policies. Often referred to in narrative as Producer / Broker to acknowledge that the role is held by broker staff.

**Quote** — a priced offer for insurance on a specific shipment. Valid 30 days.

**Quote Document** — the PDF template used to present a quote to the customer. Edited via the Document Editor.

**Quoted** — a shipment status. Premium has been calculated; the shipment is awaiting the customer's decision to book. Valid for 30 days.

**Quoted – Under Review** — a Quoted shipment currently being edited by the Back Office (typically premium or clauses). Locked from the participant until Publish Changes runs.

**Rating** — the process by which the platform computes the premium for a shipment declaration, drawing on the policy's rating tables, applicable business rules, and any special rates.

**Referral** — an underwriting review raised on a shipment that requires Back Office intervention before booking. Sub-statuses: Pending, Awaiting Information, Approved, Declined.

**Referred** — a shipment status. The shipment is paused while an underwriter resolves one or more attached referrals.

**Sales Unit** — a Group Business Partner that bundles producers reporting into the same commercial unit. Producers are placed in a Sales Unit during the Add Business Partner flow.

**Salog** — Kuehne+Nagel's legacy shipping system. The Nacora platform will expose a SOAP endpoint mimicking the Salog ShipmentWebService so K+N systems can book insurance programmatically. Salog integration is MVP second phase, not live yet.

**Shipment** — a single cargo movement declared under a policy. Has a lifecycle: Draft → Quoted → Booked, with side-branches for Referred, Under Review, Endorsed, Pending Cancellation, Cancelled, Expired, and Lapsed.

**Shipment Portal** — the participant-facing interface where shippers, consignees, and freight forwarders submit shipment declarations, view quotes, book coverage, download certificates, and request endorsements or cancellations. Authentication is passwordless — email one-time passcode or Microsoft single sign-on.

**Special Condition** — a clause added at the shipment or referral level, explicitly marked as a Special Condition, appearing in a separate section of the certificate below the standard Insuring Conditions.

**Special Rate** — a non-standard rate applied to certain risk combinations on a policy. Created through a Special Rate Request. Approved rates are picked up automatically by the rating engine on matching shipments.

**Special Rate Request (SRR)** — the application a user submits to obtain a special rate. Goes through Draft → Pending Approval → Approved (or Declined). Approved requests transition to In Use once a shipment matches.

**Surveyor / Surveyor Group** — a Business Partner (group) responsible for inspecting cargo or investigating claims. Each policy has a primary surveyor group and optionally a secondary.

**Third Party** — a policy where the insured is a client other than Kuehne+Nagel — one of the external brokers or shippers that Nacora services. Third-party policies enable the Named Assured flag on Participant Companies, since the insured is not part of the KN group and needs to be explicitly listed.

**TIPs** — the other candidate external claims management tool (vendor decision pending post-MVP).

**Under Review** — a Back Office sub-state of a shipment used when a broker or underwriter is adjusting clauses or premium. The shipment is locked from the Shipment Portal until the Back Office publishes the change.

**Underwriter** — a Person Business Partner in the Back Office who reviews shipments, handles referrals, and approves special rates.

**Updated Rate** — a broker's manual premium override on a booked shipment. Tracked in the audit trail with a mandatory reason.

**Vessel Finder API** — third-party service for IMO lookup. Returns vessel name, flag, year built, type, H-value. Used by IACS business rules. Currently latent because MVP is road-only.

**Zurich e-sign** — the e-signature integration for Nacora China / Zurich lead insurer policies. Deferred pending client/Zurich alignment on eligibility criteria; backend scaffolding exists but is on hold.

## Programme terms

**MVP first phase** — October 2025 to June 2026 build. Went live 24 June 2026 with KN Poland road logistics.

**MVP second phase and later phases** — Salog SOAP integration, China Zurich e-Marine, sea/air/rail conveyance activation, KN Bulgaria + Croatia + Hungary onboarding, full claims handling, bulk-upload-with-edits, cluster-based clause auto-assignment.

## Related concepts

- Client Overview
- How They Operate
- Kuehne+Nagel Context
- Nacora's Dual Role — Broker + MGA
- Organisation Tree
- Insurer Relationships
- Cluster & Regional Structure
- Insurance Markets & Lines of Business
- Compliance & Regulatory Context
- Delivery Scope & Roadmap
- External Systems
- Business Partner (Product space)
- Policy Creation (Product space)
- Shipment Portal (Product space)
- Rating (Product space)
