# Embed Dashboard

## What it is

The **Embed Dashboard** is a metrics and monitoring surface for embedded users — the underwriters, broker managers, and Nacora administrators who need a single glance at how the book is performing without opening ten individual screens. It sits inside NacoraHub as a first-class landing page and answers three questions at once: *what is happening operationally, what is the financial exposure, and which policies need attention?*

Today the product lives in the backlog rather than in production. It is the target end-state for BI and commercial reporting on the platform, superseding the current thin analytics tiles on the home page. This page describes what has been scoped — what the dashboard is intended to be when Phase 1 ships — so that the BA team has one canonical reference during design reviews.

## Who uses it & where

The dashboard is aimed at three internal roles:

- **Underwriters and Back Office reviewers** — to see the work queue at a glance (referrals awaiting action, quotes pending, declined shipments) and to understand how the rules and rates they configured are actually behaving in the wild.
- **Broker managers and administrators** — to monitor premium volume, insured value, policy expiry pipeline, and adoption metrics such as the number of named assureds actively transacting.
- **Nacora commercial leadership** — to track book-level KPIs (referral rate, decline rate, quote-to-booking conversion) and to reason about performance by cluster, country, or broker without exporting data.

It is reached from the top of the NacoraHub landing surface, replacing the current lightweight analytics tiles. Participants and external portal users do not see the Embed Dashboard — it is a back-office tool.

## How it works

### The three-tab structure

The dashboard is organised into three tabs, each answering a different question.

**1. Operational Overview.** The shipment work-in-progress view. It counts shipments by status — Referred, Declined, Quoted, Quoted (Under Review), Lapsed, Booked, Booked (Under Review), Booked – Endorsed, Booked – Endorsed (Under Review), Cancelled, and Booked – Pending Cancellation Approval. On top of these raw counts sit the derived KPIs: referral rate, decline rate, number of insured (booked) shipments, and the quote-to-booking conversion percentage. A "Work Queue / Attention Required" band at the top surfaces the three lists an underwriter reaches for first — referred shipments pending action, quotes pending review, and recently declined shipments — with click-through into the shipment detail.

**2. Financial / Exposure Overview.** The money view. Total premium volume and total insured value are the anchor tiles. This tab is what the finance and commercial leads open when they want to know how the book is doing this month or quarter without waiting for the monthly bordereau report.

**3. Policy Overview.** The renewal and lifecycle view. Summary KPIs cover the number of active policies, the number of policies expiring in the next 60 to 90 days, and the number of incomplete policies. Below the KPIs sits a detailed operational list of policies expiring soon — Policy Name / Policy Number, Broker Company, Renewal / Expiry Date, and a countdown of days remaining. This is the tab a broker manager opens on Monday to plan the week's renewal outreach.

Two supplementary panels round out the dashboard: **Business Rules Monitoring** (number of referrals triggered, declines vs approvals) and **Special Rates Usage** (number of Special Rate Requests created, number in active use). Both feed back into the operational tab conceptually but earn their own tiles because they are levers underwriters actively tune.

### Filters and drill-downs

Applied filters update *every* KPI, chart, and list on the currently selected tab — the dashboard behaves as a single filtered dataset, not per-tile. The filter set covers:

- **Cargo / Commodity Group.**
- **Route** (departure and destination).
- **Broker Company / Policy.**
- **Vessel name** — included specifically so that during a General Average event a user can pull up every shipment on a named vessel in seconds. This is one of the highest-value scenarios the dashboard is designed for.

Any tile in the operational tab is clickable. Clicking a status count opens the corresponding shipment list pre-filtered to that status; clicking a policy in the expiry list opens the policy 360.

### Data sources

The dashboard aggregates from every core module of NacoraHub plus a set of adjacent Kuehne+Nagel and Nacora systems. Phase 1 sources are the platform's own data:

- **Shipment data** — the primary operational feed, including statuses, premium, insured value, cargo description, commodity group, and route.
- **Policy data** — for the active/incomplete/expiring counts and the renewal pipeline.
- **Referral records** — for the work-queue tiles and Business Rules Monitoring panel.
- **Special Rate Requests and active Special Rates** — for the Special Rates Usage panel.
- **FX rates** — so that premium and insured value can be aggregated into a single presentation currency regardless of the currency each shipment was rated in.

Phase 2 adds external and cross-system sources. The scoped intent is to pull in Kuehne+Nagel shipment data (all cargo K+N moves, not just what is insured through Nacora), claims data, customer segmentation data, and integrations with myKN and SALOG. The Phase 2 story is: contrast what Nacora insured against what K+N actually shipped, so the commercial team can see cross-sell and penetration opportunities.

### Phase 1 vs Phase 2 scope

**Phase 1** — the internal metrics view. Everything above that reads from platform data (shipments, policies, referrals, Special Rates, premium, insured value, FX). Filters and drill-downs. The three tabs plus the Business Rules and Special Rates panels. This is the shippable MVP of the dashboard.

**Phase 2** — the cross-system view. Adds Kuehne+Nagel shipment volume comparison, claims data, customer segmentation, and myKN / SALOG integrations. Enables penetration analysis (insured vs total K+N book) and richer commercial reporting. Phase 2 depends on external system access agreements that are not yet in place.

### Distinguishing bulk-uploaded shipments

The dashboard includes shipments regardless of how they were created — manually through the Shipment Portal or via the bulk upload path. Both are counted in the operational totals and the financial exposure. What the dashboard *also* does is tag each shipment with its origin, so a user filtering by cargo category can see how much of the volume came from bulk upload vs manual entry. This matters because bulk uploads and manual shipments have different data-quality profiles and different levels of underwriter attention — mixing them into a single number without distinction hides useful signal.

### Access and permissions

The dashboard is scoped by the same visibility rules that already apply to the underlying shipments and policies. A broker sees the shipments and policies within their own broker company; an underwriter attached to a specific cluster sees the book for that cluster; a Nacora administrator sees everything. Filters can only narrow the visible set — a user cannot use the dashboard to see data they would not see in the corresponding listing page.

## Business rules & calculations

- **Referral rate** is calculated as referred shipments divided by total quoted shipments, over the currently filtered set and time window.
- **Decline rate** is declined shipments divided by total shipments considered (quoted + declined at first pass), over the currently filtered set.
- **Quote-to-booking conversion** is booked shipments divided by quoted shipments. Lapsed quotes are excluded from the numerator but included in the denominator.
- **Premium and insured value totals** are converted to a single presentation currency using the daily FX rates already used by the rating engine. A shipment quoted yesterday uses yesterday's rate; the totals therefore represent the historical premium as-quoted, not a re-valuation at today's rates.
- **Policies expiring in the next 60 to 90 days** is a rolling window from the current date. The countdown on each row updates daily.
- **Filters combine as AND** — selecting Commodity = Beverages *and* Route = Poland → Germany narrows the dataset to shipments matching both, not either.
- **Data freshness** is an open point (see Open Questions). Whether tiles refresh in real time, hourly, or daily is not yet agreed with the client.

## Related concepts

- Analytics & Reporting
- Business Rules
- Special Rate
- Referral Management
- Shipment Statuses
- Bulk Upload
