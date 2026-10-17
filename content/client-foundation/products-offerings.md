# Products & Offerings

## The product line — Open Marine Cargo

Nacora sells **cargo insurance** — coverage for goods and commodities in transit between an origin and a destination. The single product delivered in this build is **Open Marine Cargo**. All configuration in the wizard, all rating tables, all clauses in the library, and all business rules are scoped to this one product line.

Marine cargo is the historical anchor for the whole discipline of cargo insurance — the wording, the coverage levels, and the market conventions all trace back to marine practice even where cargo now moves by land or air. Nacora's product carries that heritage: the coverage levels are Institute Cargo Clauses ("Institute" being the Institute of London Underwriters, the body that originated the standard wording), and the certificate design follows marine cargo convention.

Beyond the product line, the **model** is *embedded cargo*: insurance offered as an add-on inside K+N's core shipping workflow. When a K+N logistics team books a freight movement, the option to insure it via Nacora is presented as part of the same operational flow. It is not a stand-alone retail insurance product sold in an open market — it is a group insurance capability offered inside the K+N shipping experience.

## Conveyance — how goods travel

Every cargo insurance policy is scoped to one or more modes of transport. The four modes are:

- **Sea** — the classical mode. Container shipping, break-bulk, project cargo.
- **Air** — the fast, high-value mode. Air freight, express.
- **Road** — trucking, cross-border haulage.
- **Rail** — intermodal rail, block trains.

**MVP delivery ships Road only.** Sea, air, and rail are configured but not activated for KN Poland at go-live. Later phases will bring them online via policy endorsement — the underlying rating dimensions already accept them, so activation is a configuration change on the policy, not a build. Higher-margin sea and air are the target for phase 2.

## Coverage levels — the Institute Cargo Clauses

The three coverage levels are the **Institute Cargo Clauses**, the market-standard coverage wording written by the Institute of London Underwriters and universally used in marine cargo insurance:

| Level | What it covers | When it's used |
|---|---|---|
| **ICC A** | "All risks" — the broadest cover. Covers loss or damage from any external cause except the specific exclusions. | Default for most participant shipments. High-value general cargo. |
| **ICC B** | **Named perils** — fire, sinking, overturning, jettison, water damage, entry of sea/lake/river water, plus a few specific perils. Middle level. | Middle-value cargo where "all risks" would be over-cover. |
| **ICC C** | **Catastrophic perils only** — the narrowest cover. Only major event losses. | Low-value cargo or where the customer wants only catastrophic protection. |

On top of the base ICC wording, individual **clauses** are attached to policies and shipments. Clauses can be **Global** (drawn from the master library curated by administrators), **Cluster** (regional defaults), or **Policy-specific**. Clauses can also be marked as **Special Conditions** on the shipment or referral — they then appear in a distinct section of the certificate below the standard Insuring Conditions.

Coverage type is one of the rating dimensions and drives the Insuring Conditions text printed on the Certificate PDF.

## The rating dimensions

Every shipment's premium is a function of six independent dimensions:

| Dimension | Values | Notes |
|---|---|---|
| **Commodity Group** | Consumer Electronics, Frozen Food, Pharmaceuticals, Beverages, Antique Art, Animals, and more (configurable per policy) | AI-suggested from free-text cargo description using AWS Bedrock. Accuracy depends on seed examples on each commodity group record. |
| **Packing** | Professionally Packed, Unpacked, and others (configurable per policy) | A rating dimension. |
| **Conveyance** | Road, Sea, Air, Rail | Road only for MVP. |
| **Coverage** | ICC A, ICC B, ICC C | Institute Cargo Clauses; drives certificate wording. |
| **Origin → Destination** | Country pairs, grouped into regions by lookup tables | **Rates are bidirectional** — Africa→Asia is the same rate as Asia→Africa. Regions collapse permutations. |
| **Insured Value** | Numeric, in a policy-configured currency | Capped by the policy's **Max Insurable Limit per Shipment**; declaring above the cap triggers a referral rather than blocking the form. Converted to policy billing currency using the **previous day's FX rate** from currencyapi.com. |

Beyond base rates the pricing engine applies **up to 11 configurable charge levels** (surcharges, discounts, minimum premium overrides) plus any **Business Rule** adjustments and any matching **Special Rate Request** (SRR) if one has been approved for the specific combination.

## Documents produced

Two customer-facing documents:

- **Quote PDF** — issued before booking. Contains the premium breakdown, the applicable clauses, the Insuring Conditions text, and a QR code linking to a digital copy. Valid 30 days.
- **Certificate PDF** — issued at booking. Same core structure as the quote but confirmed. Re-issued on every shipment endorsement or Back-Office premium change; previous versions stay accessible on the Documents tab.

Both are template-versioned. Multi-language support covers **English, Chinese, French, German, Spanish, Japanese, Turkish, and Portuguese** — eight languages. Language is picked on the shipment declaration form and used for that specific shipment's documents.

## Who buys the product

The Policyholder — the K+N regional entity that fronts the master contract — is the "buyer" in a formal sense, but the actual demand comes from downstream:

- **K+N Road Logistics teams** (the Participant Companies) that submit day-to-day shipments and use the platform to insure each consignment as it moves.
- **External freight forwarders** attached to a policy as Participant Companies (DHL, DSV, and similar). Not applicable to the current MVP pilot but supported by the platform for future onboardings.

The MVP pilot is KN Poland — one Policyholder, nine Road Logistics Participant Companies.

## Who underwrites the product

Every policy is bound to one of two insurers:

- **GFH Underwriting Agency LTD** — Nacora's in-house / captive underwriting agency. Underwrites **Nacora-branded ("KN") policies** — cover for K+N's own business.
- **Allianz Global Risks US** — the third-party underwriter for **non-Nacora-branded policies** — cover placed on behalf of external clients.

Policies can in principle carry up to three insurers (co-insurance) with shares totalling exactly 100%; exactly one is nominated as the **Lead Insurer**. In current MVP practice, KN policies use GFH at 100%. See **Insurer Relationships**.

## Not in the MVP

Explicitly out of the current release:

- **Sea, Air, and Rail conveyances** — activated in later phases via policy endorsement once road is stable.
- **Full claims handling** — MVP has a 3-step claims logging flow only. End-to-end claims management + external claims tool integration (LIMs or TIPs — vendor undecided) is post-MVP.
- **Cluster-based clause auto-assignment** — the manual and business-rule paths ship in MVP; auto-assignment by similarity is a later enhancement.
- **Bulk shipment upload with edits** — MVP ships bulk upload read-only. Bulk-uploaded shipments now run through business rules (change decided post-KT); allowing edits, rate amendments, and rule re-runs on bulk-uploaded records is a post-MVP client ask.
- **Bulk policy upload** — a client ask, not yet in scope.
- **Additional product lines** beyond Open Marine Cargo — none in current planning.
- **Salog SOAP integration** for K+N's operational shipping systems — MVP 2nd phase.
- **China Zurich e-Marine integration** — a second insurer product line for the China market, later phase.
- **Nacora Bulgaria / Croatia / Hungary go-lives** — planned expansion under Nacora Austria as parent.

## Related concepts

- Client Overview
- How They Operate
- Insurance Markets & Lines of Business
- Insurer Relationships
- Delivery Scope & Roadmap
- Organisation Tree
- Compliance & Regulatory Context
- Glossary
