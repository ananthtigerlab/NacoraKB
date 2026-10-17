# Client Foundation Space — Audit & Rebuild Report

Working audit of the Client Foundation space of the Nacora KB.
Space scope: strategic / contextual pages for a BA + delivery-lead audience.
Owner: BA on the Nacora MGA Embedded Cargo delivery.

---

## 1. Tier 1 concepts a BA needs about the client

The Tier 1 list below is the inventory a BA joining the Nacora delivery needs to know about *the client itself* (not the product, not the technical build). Every item is either a fact about who Nacora is, how they operate, what they sell, who's around them, or where the delivery is going.

| # | Tier 1 concept | Why it matters to a BA |
|---|---|---|
| 1 | Client identity — who Nacora is | Anchors every conversation. Nacora is not Kuehne+Nagel and not the insurers; they sit in the middle. |
| 2 | Kuehne+Nagel context — the parent | K+N owns Nacora and is the primary customer. K+N's operating scale is why cargo insurance is an in-house business. |
| 3 | Nacora's dual role — broker + MGA | Two commercial hats, two systems, two data models. Getting this wrong contaminates every requirement. |
| 4 | BMS vs MGA — the two-system split | The MGA delivery lives alongside a broker/billing system it feeds monthly. Scope guard. |
| 5 | How they operate — the commercial flow | Insurer → Nacora → Policyholder → Participant. The day-in-the-life sequence. |
| 6 | Products & offerings — Open Marine Cargo | The one product delivered. Cargo insurance for goods in transit. |
| 7 | Insurance markets & cargo insurance domain | Institute Cargo Clauses, the marine cargo market, the broker/MGA distinction as insurance archetypes. |
| 8 | Insurer relationships — GFH and Allianz | Two insurers, distinct roles (in-house vs third-party). Every policy is bound to one. |
| 9 | Organisation tree | The Broker → Policyholder → Participant Company → Participant hierarchy. Drives visibility. |
| 10 | Cluster & regional structure | Regional grouping between global and policy. Drives clauses and referral routing. |
| 11 | Delivery scope & roadmap | MVP road-only, phase-2 conveyances, geographic expansion. The runway. |
| 12 | Key people & contacts | Named participants on both sides — delivery, client, insurer. |
| 13 | Compliance & regulatory context | Sanctions, embargoed jurisdictions, EU insurance regulation shaping the platform. |
| 14 | Terminology / glossary | Every named business term used across the KB. |
| 15 | External systems Nacora talks to | Salog, PDM, currency provider, GeoRisk, Vessel Finder, Google Maps — client-side integration surface. |

Tier 2 nested items are covered inside each page as facts, tables, and lists (specific entities, dates, insurers, geographies, terminology).

---

## 2. Existing pages — classification

Baseline before this pass: 6 pages.

| Existing page | Classification | Gap summary |
|---|---|---|
| `client-overview.md` | NEEDS EXPANSION → REWRITTEN | Covered the basics well but leaked delivery-scope + risks content that belongs on dedicated pages. Trim + refocus on identity. |
| `how-they-operate.md` | NEEDS EXPANSION → REWRITTEN | Good day-in-the-life but under-covered the two-system split and the commercial economics (commissions, bordereau flow). Expand. |
| `products-offerings.md` | NEEDS EXPANSION → REWRITTEN | Covered the product but missed the domain framing (marine cargo market, why Institute Cargo Clauses matter). Expand. |
| `organisation-tree.md` | ADEQUATE (kept as-is, minor cross-link additions) | Comprehensive treatment of the tree, roles, relations, and visibility. Only cross-linking updates. |
| `key-people.md` | INADEQUATE → REWRITTEN | Placeholder text only. Rewrite with every named person surfaced from the sources (Marcel Behnke, Mark Vogel, Hardy Heise, Elisca Wepener, Thiva, Amar, Andrea, Tah, etc.). |
| `glossary.md` | ADEQUATE (kept as-is, cross-link additions) | Comprehensive. Only surface tweaks. |

## 3. Missing Tier 1 concepts (created in this pass)

| New page slug | Concept |
|---|---|
| `kuehne-nagel-context.md` | Kuehne+Nagel context — the parent group |
| `nacora-dual-role.md` | Nacora's dual role — broker + MGA |
| `bms-mga-relationship.md` | BMS vs MGA — the two-system relationship |
| `insurance-markets-and-lines-of-business.md` | Insurance markets & lines of business — the cargo insurance domain |
| `insurer-relationships.md` | Insurer relationships — GFH & Allianz Global Risks US |
| `cluster-and-regional-structure.md` | Cluster & regional structure |
| `delivery-scope-and-roadmap.md` | Delivery scope & roadmap — MVP through post-MVP |
| `compliance-and-regulatory-context.md` | Compliance & regulatory context |
| `external-systems.md` | External systems Nacora talks to |

---

## 4. Sources consulted

- Google Slides "Nacora High-Level Overview" (cached earlier; content reflected via existing pages and via `key-people.md`, `organisation-tree.md`, `delivery-scope-and-roadmap.md`).
- KT session transcript 2026-06-23 (Thiva → team). Reflected via `client-overview.md`, `delivery-scope-and-roadmap.md`, `key-people.md`, and `bms-mga-relationship.md`.
- Official docs at `nacora-docs.i2go.io` (parsed at `/tmp/nacora-docs/text/*.md`). Reflected across every page — especially `glossary.md`, `how-they-operate.md`, and `organisation-tree.md`.
- Existing KB pages under `content/delivery/*.md`, `content/product/*.md`, and `content/technical/*.md` — mined for client-context facts (Marcel Behnke, cluster model, sanctions integration, insurer split, ICC coverage levels, bordereau flow, PDM, Salog, etc.).

---

*(End-of-pass summary added below after all pages have been written.)*
