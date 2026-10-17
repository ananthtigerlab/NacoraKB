# Search & Filter

## What it is

Search & Filter is the cross-cutting UX pattern that appears on every listing page in NacoraHub — the Shipments dashboard, the Referrals dashboard, the Special Rates dashboard, the Special Rate Requests dashboard, the Policies list, the Business Partners list, the Claims list, the Mail Queue, the Audit Trail, the Business Rules list, the Clauses list. Different pages surface different fields, but the interaction model is the same everywhere. This page documents that model so a user learning one dashboard understands them all.

The pattern combines a **global keyword search bar** at the top of the page with a **structured filter panel** on the side (or as a top row of chips). Keyword search is fast and loose; filters are precise. Users combine them.

## Who uses it & where

- **Every role that uses a listing page.** Brokers, Participants, Underwriters, Administrators, Finance — the interaction model is the same for all of them.
- **Backoffice and Shipment Portal** — the pattern is portal-agnostic. The Shipment Portal shows a scoped subset of the same pattern (fewer filters, but the same behaviour).

Every dashboard listed in Dashboard Pages Reference exposes some version of this pattern.

## How it works

### The keyword search bar

At the top of every listing page there is a keyword search input. Behaviour:

- **Server-side search.** The user's typed string is sent to the server; the server returns matching records. No client-side filtering of a pre-loaded set.
- **Matches multiple fields.** Every listing has a "search corpus" — the set of fields the keyword search matches against. For shipments it is number, named assured name, tracking number, cargo description, policy number, and (if enabled) commodity group. For referrals it is referral number, shipment number, and the rules-triggered summary. Each listing's corpus is designed for the dominant search intent.
- **Case-insensitive** and **partial-match.** Typing "poland" matches "KN Poland" and "Poland Road".
- **Debounced.** The search fires 250ms after the user stops typing to avoid firing a request per keystroke.
- **Preserves other filters.** Applying keyword search does not clear the structured filter panel; the two combine with AND semantics — results must match both the keyword and every active filter.

### The structured filter panel

Every listing exposes a filter panel with a curated set of filter dimensions. For shipments this includes: status, policy, participant company, date range, conveyance (from I2G-30053), commodity, insured-value range. Each dimension is either a dropdown (single or multi-select), a date range, a numeric range, or a toggle.

- **Multi-select semantics.** Selecting two values for the same dimension is OR (status = Booked OR Referred); combining values across dimensions is AND (status IN [Booked, Referred] AND policy = MC-000123).
- **Clear filter** and **Clear all** actions are always visible.
- **Applied filters appear as chips** above the results list so the user can see what's actively narrowing the view.

### Preference persistence

Every listing's search string, filter selections, sort column, sort direction, page size, and column visibility are **remembered per user per listing** (see Shipment Preference Persistence). Reopening the listing the next day restores exactly what the user left in place.

To restore defaults, users click **Reset to default view** on the filter panel — clears search, clears filters, resets sort, resets page size.

### Sorting

Every column with an obvious ordering (dates, numbers, names) is sortable. Clicking the header toggles ascending, descending, and unsorted. The active sort is captured in preferences and persists.

### Pagination

Server-side pagination. Default page size varies by listing (25 for shipments, 20 for referrals, 15 for policies). Users can change the size to 10, 25, 50, or 100; the choice is remembered.

### Faceted counts

Some listings show **faceted counts** next to each filter value — e.g. "Status: Booked (247), Referred (18), Declined (4)". Counts are computed against the current keyword and other filters; changing another filter recomputes the facets. This lets users see the effect of a filter before applying it.

### Export from a filtered view

Every listing that supports export honours the currently-applied search + filters. Clicking Export downloads only the visible slice, not the full underlying dataset. Format selection (CSV or XLSX) is honoured (from I2G-30007).

## Options & choices

### Search corpus by listing

| Listing | Search corpus |
|---|---|
| Shipments | Shipment number, named assured name, tracking number, cargo description, policy number, commodity |
| Referrals | Referral number, shipment number, rules-triggered summary, assigned to |
| Special Rate Requests | SRR reference, title, policy number, requester name |
| Policies | Policy number, external policy number, policy name, policyholder name |
| Business Partners | Name, tax ID, email, phone |
| Claims | Claim number, shipment number, named assured name, cause of loss |
| Mail Queue | Recipient email, template name, related record number |
| Audit Trail | Actor name, record number, action type |
| Business Rules | Rule name, rule number, category |
| Clauses | Clause code, clause name, category |

### Filter panel dimensions (representative)

Full lists live on each dashboard's own reference in Dashboard Pages Reference. Common dimensions:

| Filter dimension | Common values / type |
|---|---|
| Status | Multi-select of the listing's status set |
| Policy | Multi-select from user's visible policies |
| Broker Company | Multi-select from user's visible brokers |
| Participant Company | Multi-select from user's visible participants |
| Date range | From-to date pickers |
| Conveyance | Air / Sea / Road / Rail (multi-select) |
| Commodity | Multi-select from Choices |
| Insured-value range | Numeric from-to |
| Currency | Multi-select from active currencies |
| Assigned to | Multi-select of underwriters (referrals, SRRs) |
| Cluster | Multi-select of active clusters |

### Actions on results

| Action | Where |
|---|---|
| Open detail | Click a row |
| Bulk select | Checkbox column (on listings that support bulk actions like Bulk Rerate) |
| Export | Toolbar → Export (respects current filters) |
| Save current view | Toolbar → Save view (planned enhancement, not yet MVP) |
| Reset to default view | Filter panel → Reset to default view |

## Business rules & calculations

- **Every list respects role-based visibility.** Even before search and filters run, the listing's queryset is scoped to what the current user is allowed to see. A broker in Poland cannot search their way to a shipment belonging to a broker in Austria.
- **AND across dimensions, OR within.** Two values on the same filter widen; two dimensions narrow.
- **Server-side always.** Every search and every filter round-trips to the server. No client-side hidden results.
- **Preferences persist per user per listing.** Two listings are independent — configuring the Shipments listing does not affect the Referrals listing.
- **Faceted counts respect the current filter state** (except the filter being computed). Users can see "if I add this filter, this many results remain".
- **Empty result state** is a friendly "no matches" message with a Clear all filters button, not an error.

## Related concepts

- Shipment Preference Persistence
- Dashboard Pages Reference
- Permissions Management
- Analytics & Reporting
