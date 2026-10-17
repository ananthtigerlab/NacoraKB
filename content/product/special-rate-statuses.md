# Special Rate Statuses

## What it is

Special Rate Requests progress through a defined lifecycle from creation to becoming an active rate that affects the pricing of matching shipments. This page is the canonical reference for the statuses on the request itself, the statuses on the individual rate combinations inside a request, what transitions are possible from each state, and who can make each transition.

Special Rates and Special Rate Requests are distinct concepts. A Special Rate is an approved, published rate that the rating engine picks up when a shipment matches its scope. A Special Rate Request is the application submitted to obtain such a rate — it carries the proposed combinations, the reasoning, and the audit trail through review.

## Who uses it & where

- **Producers and participants** submit Special Rate Requests when the standard rated premium does not work commercially for a specific movement or set of movements. Requests can be submitted from the Shipment Portal or from a shipment in the Back Office.
- **Underwriters and brokers** review Special Rate Requests in the Back Office. The reviewer approves the request as a whole once every combination in it is confirmed, or declines with a reason.
- **The rating engine** consumes approved rates automatically — every matching shipment picks up the rate on quoting.

## How it works

### Request statuses

Every Special Rate Request has an overall status that determines who owns it and what actions are available.

| Status | Editable? | Deletable? | Notes |
| --- | --- | --- | --- |
| **Draft** | Yes | Yes | Author is still preparing the request. Not visible to the Back Office. |
| **Pending Approval** | Back Office only | Back Office only | Submitted and waiting for an underwriter to review combinations and confirm rates. |
| **Approved** | Limited | No | All combinations confirmed by the Back Office. The rate is published and ready to use by the rating engine. |
| **Declined** | No | No | The Back Office declined the request. Reason recorded on the record. Terminal. |
| **In Use** | No | No | At least one shipment has already matched and used the rate. |

### Combination statuses

Within a single Special Rate Request, each combination (each row representing a unique risk scope — for example a specific commodity plus conveyance plus route) also carries its own status. The Back Office can approve or decline individual combinations independently.

- **Draft** — the combination is being defined. Editable by the author.
- **Approved** — the combination has been confirmed by the Back Office.
- **Declined** — the combination has been rejected by the Back Office, with a reason recorded.

The request as a whole moves to Approved only when every combination in it has been confirmed. A single declined combination holds the whole request out of Approved status until the author edits or removes it.

### Transitions

**From Draft.** The author submits the request for approval, which moves it to Pending Approval and hands it to the Back Office. Alternatively, the author deletes the draft.

**From Pending Approval.** The Back Office reviewer confirms every combination and the request moves to Approved. Or the reviewer declines the request and it moves to Declined with a reason. Or the reviewer sends the request back to the author for edit — it returns to Draft.

**From Approved.** The rate is now live. The first time a matching shipment quotes against it, the request moves to In Use.

**From In Use.** The rate continues to be applied to matching shipments until its effective end date passes or the rate expires through inactivity, at which point it moves to Expired.

**From Declined.** Terminal. The author can start a fresh request if they want to try again with different combinations or reasoning.

**From Expired.** Terminal.

### Rate lifetime and inactivity

An approved rate is bounded by its effective and expiry dates. Additionally, rates expire after 90 days of inactivity — a rate that goes unused for that long is treated as no longer needed and is retired. Rates that are In Use continue to apply until either their effective end date passes or they are explicitly retired.

## Business rules & calculations

- **Requests move to Approved only when every combination inside is confirmed.** A partial decline holds the whole request until the author edits or removes the declined combinations.
- **Combinations can be approved or declined independently.** The Back Office does not have to accept or reject the whole request as an atomic unit.
- **Declined is terminal.** A declined request cannot be re-opened. Starting again means creating a new request.
- **Approved is not the same as In Use.** An Approved rate is live and available; it becomes In Use only when the first matching shipment picks it up.
- **In Use is not the same as Active forever.** In Use means at least one shipment has matched. The rate can still expire — by its own effective/expiry dates, or through 90 days of inactivity.
- **Send back to Draft.** The Back Office can return a Pending Approval request to Draft to give the author a chance to edit before a final decision. This is not the same as declining.
- **Reasons are mandatory on decline.** Every declined combination and every declined request carries a mandatory reason on the record.
- **Visibility is role-scoped.** Submitters see requests they created. Back Office users see every request in the pipeline. The underlying record is the same.
- **Underwriter workload.** The same Back Office reviewers who handle referrals also handle Special Rate Request approvals. Both queues surface in similar dashboards.

## Related concepts

- Special Rate
- Referral Management
- Shipment Portal
- Dashboard Pages Reference
- Rating
