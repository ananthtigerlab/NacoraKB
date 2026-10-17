# Login

## What it is

Nacora has two separate login destinations, each mapped to a different user type. The Backoffice at **nacora-bo.i2go.io** is the operational and configuration surface used by brokers, underwriters and administrators. The Shipment Portal at **nacora-sp.i2go.io** is a stripped-down, single-purpose site where participant company staff quote, book and manage their own shipments. A user cannot cross-visit: a request for a Backoffice page from the shipment-portal domain, or the other way round, is rejected. Both interfaces sit on top of the same underlying platform — a shipment submitted through the Shipment Portal is immediately visible in the Backoffice — but each interface is tuned to a different audience and exposes different controls.

Sign-in is required every time a user opens the Backoffice or Shipment Portal in a new browser, or after a session expires. Nacora deliberately does not block sign-in when upstream identity data is incomplete: instead, first-time SSO users whose company placement cannot be resolved automatically are allowed in, parked, and surfaced to an administrator for review via the Pending Approvals queue.

## Who uses it & where

- **Brokers / Producers (K+N staff)** — Backoffice. Full policy lifecycle, plus the ability to submit shipments on behalf of participants.
- **Administrators (K+N staff)** — Backoffice. Business partner maintenance, pending approvals, global clauses, choices, exchange rates, business rules.
- **Underwriters (GFH or Allianz Global Risks US staff)** — Backoffice. Referral review, special rate request decisions, premium and clause overrides.
- **Participants (K+N logistics teams or external freight forwarders)** — Shipment Portal only. Shipment quote, book, endorse, cancel.

Which interface a user lands on is decided entirely by their role — an underwriter who is also an administrator still lives in the Backoffice; a participant who is also a Named Assured still lives in the Shipment Portal.

## How it works

The auth path depends on **who is signing in** and, secondarily, on which portal they are targeting. Three methods are supported in total, split between the two portals.

| User | Interface | Auth method | Notes |
|---|---|---|---|
| K+N internal staff (brokers, admins) | Backoffice | Microsoft SSO (Okta OAuth2 against the K+N identity provider) | Recommended path. Cost centre is resolved via PDM lookup at first login to place the user under a Participant Company. |
| External or non-tenant back-office users (external underwriters, third-party brokers) | Backoffice | Direct email and password | Account is created by an administrator; the user receives a welcome email with a link to set their password. |
| K+N staff signing into the portal | Shipment Portal | Microsoft SSO | Same corporate identity as the Backoffice option. |
| External participants (non-K+N freight forwarders, external shippers/consignees) | Shipment Portal | Email One-Time Password | Six-digit code emailed to the address on file; valid for five minutes; max five attempts before block. |

The domain guard is shared across all three: the shipment-portal domain only exposes shipment-related pages; the backoffice domain exposes the full dashboard. Cross-domain requests are rejected before any authentication happens.

### Signing in to the Backoffice — step by step (Microsoft SSO, recommended)

1. Open the Backoffice URL supplied by your administrator. There may be one URL for testing and a separate one for production — make sure you have the right one.
2. On the login screen, click **Continue with SSO Login**.
3. Complete the corporate authentication challenge (typically a Microsoft sign-in and, where enforced, a multi-factor prompt).
4. On success, land directly on the home page for your role. Brokers land on the Policies dashboard; underwriters land on the Referrals dashboard; administrators land on the Business Partners dashboard.
5. Behind the scenes, the platform pulls your identity from the K+N identity system, retrieves your PDM identifier, and calls the PDM API to resolve your cost centre. If the live PDM API is unreachable, a static fallback mapping is used with a ten-second timeout. If your cost centre resolves cleanly, the correct Participant Company relation and Participant role are attached to your record on the spot. If it does not resolve, you land in the Pending Approvals queue and see an empty portal until an administrator places you.

### Signing in to the Backoffice — step by step (email and password)

1. Wait for the welcome email sent by your administrator when your account was created. The email contains a one-time link to activate the account by setting a login password.
2. Follow the link and set your password. Passwords must meet the strength rules displayed on the form.
3. Once the password is saved, return to the Backoffice URL.
4. Enter your email address and password on the login page.
5. Click **Log In**. On success you land on your home page.
6. If the platform locks you out after three failed attempts, a lockout email is sent and you must wait for the lockout window to clear or contact your administrator to reset.

### Signing in to the Shipment Portal — step by step (Microsoft SSO)

1. Open the Shipment Portal URL supplied by your administrator or broker.
2. Click **Continue with SSO Login**.
3. Complete the corporate authentication challenge against the K+N identity provider.
4. On success you land on the Shipment Dashboard for the company you belong to. The counter cards at the top of the dashboard show how many shipments you have in each status (Draft, Quoted, Booked, Referred, Cancelled).

### Signing in to the Shipment Portal — step by step (email OTP)

1. Open the Shipment Portal URL. You land on the login page.
2. Enter the email address you were registered with and click **Continue with email**.
3. Check the inbox of that address for a six-digit numeric code. The email arrives within seconds in normal conditions.
4. Type the six digits on the OTP verification screen. The form auto-submits as soon as the sixth digit is entered — you do not need to click a submit button.
5. On success you land on the Shipment Dashboard for the participant company associated with your email.
6. If the code does not arrive, use the **Resend Code** action to trigger a new one. A code is valid for five minutes; requesting a new code invalidates the previous code.

## What happens after sign-in

- Successful sign-in lands the user on the dashboard for their role and their company. Brokers see the pipeline of policies and shipments across their broker company hierarchy; participants see only their own company's shipments.
- A new SSO user with incomplete PDM mapping lands in **Pending Approval**. They can technically sign in — the platform does not block the session — but the dashboard is empty until an administrator selects a cost centre and Participant Company for them. The Pending Approvals workflow exists precisely because it is faster for the user to be allowed in and parked than to be turned away at the door.
- Every action taken during a session is logged against the user's Business Partner record: who did what, when, from what IP. This is what the audit trail relies on downstream.
- Sessions expire after a period of inactivity — when they do, the next request bounces the user back to the login page. Signing out from the top-right user menu ends the session immediately.

## Password reset

- **SSO users** cannot reset a Nacora password because there isn't one — password reset is handled entirely by the corporate identity provider (Microsoft / Okta). If SSO stops working, the user should contact their IT helpdesk, not the Nacora administrator.
- **Direct-credential Backoffice users** use the *Forgot password* link on the login page. A reset link is emailed and is single-use.
- **Portal OTP users** do not have a password at all. Every sign-in is a fresh OTP; there is nothing to reset.

## Signing out

The user menu in the top-right corner offers a **Sign out** action on both interfaces. Signing out ends the current session immediately. Closing the browser window without signing out does not immediately terminate the session — it will time out on inactivity — so signing out explicitly on shared machines is recommended.

## Browser recommendations

- Modern evergreen browsers only: current Chrome, Edge, Firefox, or Safari. Internet Explorer is not supported.
- Cookies and local storage must be enabled — session state relies on them.
- If SSO fails silently, third-party cookies being blocked by browser or corporate policy is the most common cause. Ask IT to allow the identity provider domain.

## Business rules & calculations

- **OTP validity:** each six-digit code is valid for five minutes from the moment it is issued. Requesting a new code invalidates the previous code.
- **OTP attempts:** five attempts per session. After five failures further attempts are blocked; the user must wait or contact an administrator.
- **PDM lookup timeout:** ten seconds against the live PDM API before the static fallback JSON mapping is consulted.
- **Auto-active roles:** Participant roles are marked active on creation (no second step needed once approved from the queue).
- **Pending users are still allowed to sign in.** They see an empty portal. Any dashboard request effectively returns no data until an administrator resolves them.
- **Password lockout for direct-credential users:** three failed attempts triggers a lockout email and a temporary block.
- **Access issues are almost always account configuration, not system errors.** If a user cannot sign in, the first action is to check their Business Partner record — is it active, does it have the right role, is it linked to a Participant Company?

## Related concepts

- Business Partner
- Permissions Management
- Admin Queue & Approvals
- Roles and Portals
- First Day Guides
