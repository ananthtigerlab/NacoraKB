# Admin Queue & Approvals

## What it is

The Admin Queue is where system administrators handle everything that cannot be automated. The largest and most frequent workload sitting in it is **Pending Approvals** — Person Business Partners who have signed in via SSO but have not yet been placed in a real Participant Company. Alongside it sit unusual referrals that need escalation and manual role assignments the platform cannot infer.

A **Pending Approval** is created whenever a user signs into the platform via SSO but the upstream identity system (PDM) either does not know them, does not have them assigned to a live cost centre, or is unreachable when the platform tries to look them up. Rather than turn the user away at the door — which is frustrating and hides information from administrators — the platform lets them in, places them in a holding company called *Nacora Pending Approval*, and surfaces the record for an administrator to review.

The queue exists because the platform does not block sign-in when PDM data is incomplete. Instead, the user is allowed in, parked, and surfaced. This is faster for the user and gives administrators a controlled place to do the placement work — including seeing the exact reason the auto-placement failed.

## Who uses it & where

- **Administrators** — the primary users, in the Backoffice. Full access.
- **Organisation Admins** — can approve pending users across their organisation.
- **Company Admins** — can approve pending users within their own company only.
- **Producers, Underwriters, Participants** — cannot see the queue at all. It is admin territory.
- **Ops teams** typically use it to unstick users who report "I can sign in but I can't see anything" — the answer is almost always a pending approval.

## What triggers a Pending Approval

A record lands in the queue in one of the following situations. Each surfaces a distinct **failure reason** on the row so the administrator knows what to do next.

| Reason | What it means | What to do |
|---|---|---|
| **PDM unreachable** | The live PDM API did not respond in time (ten-second timeout) and the static fallback did not resolve the user either. | Wait or escalate. Once PDM is back, re-trigger the user's sign-in — the record moves out of the queue automatically. |
| **Person not found in PDM** | PDM does not know the user at all. | Check whether the user is genuine. If yes, ask HR or Ops to add them to PDM first, then approve. If no, reject. |
| **No active cost centre in PDM** | The user exists in PDM but is not assigned to an active cost centre. | Have HR or Ops update PDM with the correct assignment, then approve. |
| **Unmapped PDM UID** | PDM returned an identifier that the platform does not have a mapping for — the cost-centre code exists on PDM's side but no Participant Company on Nacora's side matches it. | Ask an administrator to add the mapping, then approve. |
| **Forced pending** | Manually flagged for review by an administrator during onboarding, or by a business rule that requires human placement. | Approve when ready. |

## The queue at a glance

Each row in the queue shows:

- The user's name and email.
- The inferred PDM identifier, if any.
- The failure reason explaining why automatic placement failed.
- The date and time the record entered the queue.

Clicking a row opens a details panel with the fields needed to resolve the record — the dropdown for the target Cost Centre / Participant Company, action buttons for **Approve** and **Reject**, and an audit trail of any prior attempts.

## How it works — the approval flow

1. A new SSO user opens the Backoffice or Shipment Portal and completes the SSO challenge. Authentication succeeds.
2. The platform pulls the user's PDM identifier and calls the PDM API to resolve their cost centre. If the live PDM API is unreachable the platform consults its static fallback mapping (ten-second timeout).
3. If the cost centre resolves cleanly, the platform attaches the correct Participant Company relation and Participant role and the user lands on their dashboard normally. No queue entry is created.
4. If the cost centre does not resolve, the platform still creates the user record — but it attaches them to the *Nacora Pending Approval* holding company and marks the record with a pending-approval flag. The user is allowed to complete sign-in but sees an empty dashboard.
5. Middleware on the platform notices the pending flag on every subsequent request and bounces the user to the pending-approval landing page. Authentication pages remain accessible — the user can still complete an SSO refresh, reset an OTP — but the operational surfaces are hidden.
6. The record appears in the Admin Queue for administrators to review.
7. An administrator opens the queue, picks a row, reads the failure reason, verifies the user against whatever external source their team uses (a Slack DM, an email confirmation from HR, a ticket from the user's manager) and decides.
8. On **Approve**, the administrator selects the target Cost Centre / Participant Company from a dropdown and confirms. The platform moves the user out of the holding company, attaches them under the chosen Participant Company, refreshes their roles, and clears the pending flag. On the user's next page load they see the right data for their cost centre.
9. On **Reject**, the administrator provides a reason (kept on the user's record for audit) and confirms. The user remains in the holding company but is deactivated. They will not be re-evaluated on the next sign-in unless their record is reset.
10. All admin actions are audited — who approved or rejected whom, when, with what reason.

## The approve action — step by step

1. Sign in to the Backoffice.
2. Open the Pending Approvals page from the admin menu.
3. Scan the queue. Prioritise the oldest rows — users are waiting.
4. Click a row to expand the details panel.
5. Read the failure reason. If it is one that requires upstream action (PDM has to be updated first), do not approve — coordinate with the team that maintains PDM, wait for the fix, and only then approve.
6. If the record is ready to approve, confirm the PDM record exists and points at an active cost centre. If not, the PDM mapping needs to be updated first; ask an administrator to add the mapping before approving.
7. Select the **target Cost Centre / Participant Company** from the dropdown. Cost centres are not arbitrary — they are mapped to PDM identifiers, and picking the wrong one silently misroutes the user's future sign-ins.
8. Click **Approve**.
9. Confirm the record now shows as *Active* on the Business Partners dashboard.

## The reject action — step by step

1. Open the row from the queue.
2. Click **Reject**.
3. Provide a reason. The reason is kept on the user's record for audit. Write it as if a future administrator or auditor will read it out of context.
4. Click **Submit**.

Rejection is not a delete — the user record stays on file, deactivated. To un-reject, an administrator resets the record and re-triggers sign-in.

## Related roles

- **Administrator** — full queue access, can approve or reject any pending user.
- **Organisation Admin** — can approve users across the organisation they administer.
- **Company Admin** — can approve users where the target company is their own; cannot see other companies' pending users.
- **Producer / Underwriter / Participant** — no access. They see none of the queue.

## Business rules & calculations

- **Pending users are trapped.** They can sign in, but every operational page redirects to the pending-approval landing page until an administrator resolves them.
- **Approval is idempotent.** Approving the same user twice does not create duplicate roles or duplicate relations.
- **Rejection is not deletion.** A rejected user is deactivated but stays on record. To un-reject, reset the record and re-trigger sign-in.
- **Auth pages remain accessible to pending users.** They can still complete SSO refresh flows or reset an OTP — they just cannot reach the operational dashboard.
- **Bulk approval is not standard.** Each user is reviewed individually because the correct company and role have to be chosen. If a batch of new users arrives (an office opening, an annual onboarding round), keying them through one-by-one is still the model.
- **Cost centres are not arbitrary.** They are mapped to PDM identifiers. If you are unsure which one a user belongs in, ask before approving. The wrong cost centre gives the user access to the wrong company's data.
- **Failure reasons are informational, not blocking.** Even a "PDM unreachable" row can technically be approved — but the underlying PDM issue will re-surface on the next SSO refresh unless it is fixed upstream first.
- **A user with no valid Participant Company parent will sign in but see nothing.** The Pending Approvals workflow exists to catch exactly this — do not work around it with manual relations. Manual bypass can leave the user under the wrong parent and hide the misplacement.

## Related concepts

- Login
- Business Partner
- Permissions Management
- Roles and Portals
- Audit Trail
