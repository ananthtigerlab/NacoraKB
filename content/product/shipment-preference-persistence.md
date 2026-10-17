# User Preferences & Listing Configuration

## What it is

**User preferences and listing configuration** is the layer of small-but-cumulative personalisation that makes NacoraHub feel like a working tool rather than a fresh install every session. It covers the choices a user makes about how listing pages look and behave — how many rows per page, which column to sort by, which filters are applied, which columns are visible — and it makes those choices survive across sessions so a power user does not have to reconfigure the same screens every morning.

It is not a preferences dashboard where a user goes to change settings. It is a background contract the platform holds with each user: *the way you left this listing page is the way you will find it next time you visit.* On top of listing preferences sits a locale-aware formatting layer that adapts how numbers and dates are rendered based on the user's settings, so a broker working in Poland sees `1.234,56` and `31/07/2026` where a colleague in the US sees `1,234.56` and `07/31/2026`.

## Who uses it & where

- **Every user of the platform** benefits. The persistence is user-scoped — each user's preferences are their own and do not leak into other users' sessions.
- **Nacora AT power users** were the specific voice that drove the current round of enhancements. They work with the listing pages every day, filter and sort them heavily, and the friction of resetting page size and sort order on every visit was material enough to log as a requirement.
- **Back-office reviewers, brokers, and participants** all encounter listing pages and all benefit equally. Preferences apply consistently regardless of role.

The feature is not surfaced as a "Preferences" page in the navigation. It is invisible when it works — the user notices only when it is missing. That said, the listing pages themselves are where the choices are made: users adjust page size, click column headers to sort, apply filters, toggle columns, and the platform quietly captures each choice.

## How it works

### What persists

Four categories of listing configuration are remembered per user, per listing page:

- **Page size.** How many rows the user has set the listing to show per page.
- **Sort order.** The column being sorted and the direction (ascending or descending).
- **Filter state.** Any filters currently applied — status filter, date range filter, cargo type filter, broker filter, and so on.
- **Column visibility.** Which columns the user has shown or hidden, if the listing supports column customisation.

These four are captured at the moment the user makes the change and written to the user's persisted preferences. The next time the user returns to the same listing page — in the same session or in a new browser session tomorrow — the platform loads their previous choices and applies them before rendering the first page of results.

The scope is *per user, per listing page*. The user's choices on the shipment listing do not affect the referrals dashboard; the choices on the special rates dashboard do not affect the bulk upload listing. Every listing keeps its own memory. This is deliberate: a user's mental model of the shipment list is different from their mental model of the referrals queue, and forcing shared state across them would create surprising behaviour.

### Which listing pages are covered

The pattern is applied consistently across the main working surfaces of the platform:

- **Shipment listing** — the main operational surface, where preferences matter most because a user might scan it a dozen times a day.
- **Bulk upload listing** — where a user checks the status of recent uploads and drills into individual records.
- **Referrals dashboard** — the underwriter's queue of items to review.
- **Special Rates dashboard** — where both submitters and approvers track requests.

Every listing surface follows the same interaction contract. If a user filters the referrals dashboard to "Pending Review" and sorts by "Days Waiting" descending, that view is what they see next time they open the dashboard. The consistency is the point — the user does not need to relearn each listing separately.

### Locale-aware number and date formatting

Alongside listing preferences, the platform respects each user's locale for numeric and date formatting. This is user-level configuration, applied to the way numbers and dates are *displayed* — not to how they are stored, which remains a single canonical format underneath.

The two dimensions that matter in practice:

- **Number formatting.** Thousands separators and decimal points differ between locales. Continental European conventions use `.` for thousands and `,` for decimals (`1.234.567,89`). Anglo-Saxon conventions use `,` for thousands and `.` for decimals (`1,234,567.89`). The platform reads the user's locale setting and formats accordingly. Premium amounts, insured values, rates, quantities — all currency-adjacent numbers pick up the setting.
- **Date formatting.** Day-first (`31/07/2026`) versus month-first (`07/31/2026`) versus ISO-first (`2026-07-31`). The choice is again taken from the user's locale. Date pickers respect it too — a user typing a date into a filter uses their expected format.

The locale is not the same as the language of the interface. A user working in English can still request Continental European number formatting; the two settings are independent. What matters is that the display is unambiguous for the user reading it.

### Where the settings live

The user's preferences and locale are attached to their user account, so they follow the user across devices. Signing in on a different browser or a different machine still loads the user's persisted preferences.

There is deliberately no per-tab or per-window override. If a user wants a temporary view (say, sort by a different column for one investigation), they change it in the listing — and that becomes their new persisted default. If they want to go back, they change it back. The trade-off is simplicity: one persistent state per user per listing, not a tangle of temporary overrides that get out of sync with each other.

### Restoring defaults

Every listing exposes a way to reset to platform defaults. In practice this is a "Clear all filters" control on the filter bar and a return-to-default option in the column customisation menu. Using these resets the listing to the shipped default view — the same view a brand-new user would see on their first visit. The user's other listings are unaffected; reset applies only to the listing where it is invoked.

There is no global "reset everything" action, on the grounds that a user who has invested in their working setup should not be able to blow it away with a single click. If a full reset is genuinely needed, it is an administrator-supported task rather than a self-service one.

### The cross-cutting nature of the pattern

What makes the preferences layer valuable is that it works the same way everywhere. A user who understands how the shipment listing remembers its state does not need to relearn the pattern on the referrals dashboard or the special rates dashboard — the same interactions produce the same outcomes.

This uniformity was the original driver for consolidating what would otherwise be four separate features (one per listing page) into a single cross-cutting pattern. The work started as a broader front-end usability and workflow enhancement request from Nacora AT power users and was scoped down to a focused persistence effort that could ship in a coherent block, because trying to ship the persistence separately for each listing would inevitably produce inconsistent behaviour.

## Business rules & calculations

- **Preferences are per user, per listing.** No sharing across users; no cross-listing contamination.
- **Preferences follow the user across devices.** The user's account carries the settings; signing in on a new browser still restores them.
- **The platform captures changes silently.** Users do not confirm or save preferences explicitly — the act of adjusting the listing is the act of updating the preference.
- **Locale formatting is a display concern only.** Numbers and dates are stored canonically; formatting is applied at render time based on the user's locale.
- **Locale and interface language are independent settings.** A user can read the interface in English while using Continental European number formatting, or any other combination.
- **Reset scopes are narrow.** Clearing filters clears them on that listing only. There is no cross-listing reset action.
- **New listings inherit the platform default view on first visit** — the same view a brand-new user would see. From that point forward, the user's own choices take over.

## Related concepts

- Shipment Portal
- Referral Management
- Special Rate Request Flow
- Bulk Upload
- Dashboard Pages Reference
- Login
