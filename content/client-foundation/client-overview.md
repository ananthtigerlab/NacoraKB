# Client Overview

## What Nacora is

**Nacora** is the insurance arm of the Kuehne+Nagel group — a specialist cargo and marine broker + Managing General Agent that sells, underwrites, and administers cargo insurance for the goods that move through K+N's global logistics network, and for third-party clients that use K+N's brokerage services. Nacora is a wholly-owned subsidiary of Kuehne+Nagel; it is not a stand-alone company in the market sense but the group's captive insurance business.

Nacora operates in **two commercial roles** at once:

- **The broker side.** Nacora acts as a licensed insurance broker for K+N-owned business (the freight the group carries for itself and its customers) and for external clients that ask Nacora to place cover for them. The broker side owns the client-facing commercial relationship — sales, servicing, invoicing, commission — and runs on a separate broker-management system called **NBMS / BMS**. NBMS is not the platform this KB documents.
- **The MGA side.** Nacora is also authorised to act as a **Managing General Agent** — an intermediary given underwriting authority by an insurer to price, bind, and administer policies on the insurer's behalf. On the MGA side, Nacora configures products, sets rates, applies clauses, runs business rules, adjudicates referrals, and logs claims. **This** is the side the KB documents. The platform is called **NacoraHub Cargo** internally and runs on TigerLab's i2go platform.

The KB scope is therefore *the MGA product only*: **Nacora MGA Embedded Cargo on i2go**.

## Who Nacora sits between

Every Nacora policy is a three-way relationship:

- **The insurer** — the carrier that takes the underwriting risk. Two are relevant to the current delivery: **GFH Underwriting Agency LTD** (Nacora's in-house / captive underwriting agency, for Nacora-branded / KN-owned business) and **Allianz Global Risks US** (the third-party carrier for non-Nacora-branded policies).
- **Nacora itself** — the MGA. Nacora does not carry the risk; it operates the product on the insurer's behalf.
- **The Policyholder** — a K+N regional entity (for the current MVP, KN Poland) that fronts the master contract for a group of downstream logistics teams that actually submit shipments.

The MGA sits in the middle. The BA who reads a Nacora requirement always needs to know which of the three parties owns the decision — the insurer, the MGA, or the K+N entity.

## What the product is

The MVP is a single product: **Open Marine Cargo** — cargo insurance for goods and commodities in transit between an origin and a destination, by air, sea, road, or rail.

Beyond the product line, the model is **embedded cargo**: cargo insurance offered as an add-on inside K+N's core shipping workflow. When a K+N logistics team books a freight movement, they can insure it via Nacora as part of the same operational flow. It is not a separately sold retail insurance product.

For a fuller treatment see **Products & Offerings**.

## Where the delivery stands

The MVP is **live** for **KN Poland road logistics** — that is one Broker Company (Nacora Austria), one Policyholder (KN Poland), and nine Road Logistics teams as Participant Companies. KN Poland's road-freight business alone is roughly **14% of Nacora's net turnover** — small enough to be a safe pilot, large enough to be commercially meaningful.

The remaining conveyances (sea, air, rail) and the other regional K+N entities (Bulgaria, Croatia, Hungary) are planned for later phases. Higher-margin sea and air are the target of phase 2.

For the full roadmap see **Delivery Scope & Roadmap**.

## Two-system architecture

Everything the KB documents is on the MGA side. The broker side (NBMS / BMS) is a separate system with its own database, its own users, its own auth. The two systems exchange one thing: a **monthly bordereau report** that the MGA emits and the BMS side ingests to invoice K+N customers and reconcile commissions.

This split is a permanent architectural fact. It shows up in every requirements discussion — anything to do with client billing, credit notes, cash allocation, or commission tables lives on the BMS side, not here. See **BMS vs MGA Relationship** for the full picture.

## The two audiences NacoraHub serves

- **The Back-Office** at `nacora-bo.i2go.io` — brokers, underwriters, and administrators. K+N staff sign in via Microsoft SSO; external underwriters at the insurers use username / password. This is where policies are designed, referrals are resolved, and master data lives.
- **The Shipment Portal** at `nacora-sp.i2go.io` — participants (K+N logistics staff and, in future, external freight forwarders). Passwordless: email one-time passcode (OTP, max 5 attempts per session) or Microsoft SSO for K+N staff. This is where shipments are quoted and booked day to day.

For the workflow across the two portals see **How They Operate** and **Roles and Portals** (Product space).

## Key facts at a glance

| Fact | Value |
|---|---|
| Client name | Nacora (Kuehne+Nagel's insurance arm) |
| Parent group | Kuehne+Nagel |
| Nacora's role | Broker (for K+N and third-party) + Managing General Agent |
| MGA platform | NacoraHub Cargo, on TigerLab i2go |
| Delivery model | Embedded Cargo — insurance offered inside K+N's shipping workflow |
| MVP product | Open Marine Cargo |
| MVP scope | KN Poland road logistics (≈14% of Nacora's net turnover) |
| MVP Broker Company | Nacora Austria |
| MVP Policyholder | KN Poland |
| MVP Participant Companies | 9 Road Logistics teams under KN Poland |
| MVP go-live | 24 June 2026 (master deployment) |
| KT session date | 23 June 2026 (Thiva → delivery team) |
| Insurers (MGA side) | GFH Underwriting Agency LTD, Allianz Global Risks US |
| Sister system | NBMS / BMS (broker-management system; separate) |
| Coverage levels | ICC A, ICC B, ICC C (Institute Cargo Clauses) |
| Multi-language support | 8 languages on documents (EN, DE, FR, ES, ZH, JA, PT, TR) |
| Currency provider | currencyapi.com (locked mid-build) |
| Cluster / regional layer | EMEA-North, APAC, LATAM-South (extensible) |

## What every BA should know before their first Nacora meeting

1. **Nacora is not Kuehne+Nagel.** They are a K+N-owned subsidiary. K+N is both the parent and the primary customer. Do not blur the two in requirements.
2. **Nacora is not an insurer.** They are an MGA. They price and administer policies on behalf of insurers. Risk carriers are GFH and Allianz.
3. **The KB covers the MGA product only.** Anything to do with client invoicing or commission accounting is a separate system called BMS — flag any requirement that lands on the wrong side.
4. **The pilot is deliberately small.** One region, one conveyance. Every part of the platform is built with expansion in mind but only road is live today.
5. **The three-party model is everywhere.** Insurer, MGA, Policyholder. Add the Participant Company underneath and you have the full commercial chain that shows up on every screen.

## Related concepts

- Kuehne+Nagel Context
- Nacora's Dual Role — Broker + MGA
- How They Operate
- Insurer Relationships
- Products & Offerings
- Organisation Tree
- Delivery Scope & Roadmap
- BMS vs MGA Relationship
- Glossary
