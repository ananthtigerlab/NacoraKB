# BMS vs MGA Relationship

## What it is

Nacora runs on **two connected but separate systems**. The KB is scoped to one of them; the other is out of scope but heavily referenced. This page explains the split, the one integration between them, and where every commonly-discussed requirement lands.

- **BMS side** — the **N**acora **B**roker **M**anagement **S**ystem. Sometimes called NBMS, sometimes "the broker system." Owns the client-facing commercial relationship: sales, quotes-and-policies from the broker perspective, invoicing, credit notes, cash allocation, scheme management, tax handling, commission tables. Runs on its own platform, has its own database, its own users, its own auth. **Not documented in this KB.**
- **MGA side** — the platform this KB documents. **NacoraHub Cargo** on i2go. Owns the insurance product operating system: policy configuration, rating, clauses, business rules, referrals, special rates, documents, claims logging, audit. Serves both the Back-Office (`nacora-bo.i2go.io`) and the Shipment Portal (`nacora-sp.i2go.io`).

The two systems exist because the two commercial roles they serve — broker on one side, MGA on the other — have different customers, different data models, and different lifecycles. Keeping them separate lets each evolve independently.

## Who and where

Both systems belong to Nacora. Different user populations touch each side:

**BMS side users** — Nacora broker staff (sales, servicing, finance, commissions), typically K+N group employees. Customer-facing communications, contract paperwork, and invoicing happen here.

**MGA side users** — a mixed population:
- Nacora / K+N staff working as **Producers / Brokers** (design policies) and **Administrators** (maintain master data) in the Back-Office.
- Insurer staff working as **Underwriters** at GFH or Allianz. External users on the MGA platform.
- K+N logistics staff working as **Participants** in the Shipment Portal.

For the full user model see **How They Operate** and (in the Product space) **Roles and Portals**.

## How it fits — the one integration

The two systems exchange one thing:

**The monthly bordereau feed** — a report emitted by the MGA side listing every shipment booked in the period, with premium, commission, and net-of-tax figures. BMS ingests this feed to invoice the customer and reconcile the commission position.

Data flows one direction only:

```
        (customer premium receipts, credit notes, allocations
         all stay on the BMS side)
                        ┌───────┐
                        │  BMS  │  (broker / client billing)
                        └───────┘
                            ▲
                            │  monthly bordereau
                            │
                        ┌───────┐
                        │  MGA  │  (this platform, NacoraHub Cargo)
                        └───────┘
```

There is no reverse channel. BMS does not push commission corrections, payment status, or dispute flags back into NacoraHub. Anything that BMS thinks the MGA got wrong is handled manually or by re-emitting the bordereau.

## Facts & context

**Which requirements land on which side:**

| Topic | MGA (NacoraHub — this KB) | BMS (NBMS — separate system) |
|---|---|---|
| Configuring an Open Cover / Policy | ✓ | |
| Rating a shipment | ✓ | |
| Applying clauses to a shipment | ✓ | |
| Business rules & referrals | ✓ | |
| Special Rate Requests | ✓ | |
| Certificate / quote PDF generation | ✓ | |
| Claims logging (3-step MVP) | ✓ | |
| Audit trail across the platform | ✓ | |
| Bordereau report emission | ✓ | |
| Invoicing the customer | | ✓ |
| Credit notes | | ✓ |
| Cash allocation | | ✓ |
| Bank reconciliation | | ✓ |
| Commission tables | | ✓ |
| Scheme management | | ✓ |
| Tax handling on invoices | | ✓ |
| Sales pipeline / prospecting | | ✓ |
| Full claims handling & payments (post-MVP) | To be decided — could be MGA + LIMs/TIPs | May involve BMS for settlement flow |

**Currency of language:** on MGA-side pages we say "the MGA emits" and "BMS ingests" when talking about the bordereau. This makes the direction of flow explicit. Avoid saying "billing" without a qualifier — always specify **which** system's billing.

**Reconciliation risks:**

- **FX rate divergence.** The MGA uses currencyapi.com; the BMS side has its own FX handling. Rate divergence is a known-but-tolerated risk in the current setup. Watch for FX-driven disputes.
- **Timing mismatches.** The MGA emits monthly; BMS runs on its own accounting close cadence. Cut-off dates can leave a shipment in a limbo period.
- **Cancellation & refund logic.** Refund calculations happen on the BMS side, not in NacoraHub. If a shipment is cancelled after billing, the credit note is a BMS transaction.

## Two-system consequences you will meet in delivery

**A "billing" question in a Nacora conversation is almost always ambiguous.** Ask which system: are we talking about the bordereau report (MGA emits) or the customer invoice (BMS produces)? The wording of the requirement usually gives it away, but not always.

**A "billing report" in NacoraHub is a bordereau, not a customer invoice.** The platform's Billing Reports module produces bordereau — the report to the insurer. Customer invoices belong to BMS.

**A "cancel and refund" flow crosses systems.** The shipment is cancelled in NacoraHub (audit trail on the shipment), but the actual credit note is generated in BMS after the next bordereau cycle. Do not expect a "refund button" in NacoraHub.

**A "commission" figure in the MGA is illustrative.** NacoraHub records what the broker's commission *is* on a shipment (for reporting). It does not accrue or pay that commission — the BMS commission engine does that against the bordereau.

## Related concepts

- Client Overview
- How They Operate
- Nacora's Dual Role — Broker + MGA
- Products & Offerings
- Delivery Scope & Roadmap
- External Systems
- Glossary
