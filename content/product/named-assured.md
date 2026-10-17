# Named Assured

## What it is

The Named Assured is the specific insured party recorded on a shipment or a policy — the entity to whom cover is granted. It is a Business Partner in the system's unified partner model (see Business Partner), attached to the record via a Named Assured role. The distinction matters because a policy is bound to a Policyholder (the K+N regional entity acting as Bill-to-Party), but the actual party being insured on any given shipment is frequently different — the shipper, the consignee, or a specific customer of the participant company. That party is the Named Assured, and it is what appears on the certificate.

Named Assured is a **data marker, not a sign-in role**. Named assureds do not log into the platform. What they get is documented cover — the certificate that carries their name, address, and reference on it. Some of them also receive notifications when a claim is opened on their behalf, but they do not interact with NacoraHub directly.

## Who uses it & where

- **Participants** — populate the Named Assured field on every shipment they book. This is a required attribute; a shipment cannot be quoted without one.
- **Brokers** — set up Named Assured records when the initial policy is being configured, and edit them from the Business Partner module.
- **Administrators** — maintain the master list of Named Assureds visible to a given broker cluster.
- **Bulk upload flow** — auto-creates Named Assureds from spreadsheet rows if the setting `BULK_UPLOAD_ALWAYS_CREATE_NAMED_ASSURED` is enabled and the assured doesn't exist.
- **Certificate generation** — prints the Named Assured on every certificate PDF.
- **Referral flow** — Named Assured appears on the Referral Activity Page as part of the shipment snapshot.

Named Assured lookups and creation happen inline on the shipment declaration form (Backoffice and Shipment Portal) and on the Business Partner module (Backoffice).

## How it works

### Selecting a Named Assured on a shipment

On the shipment declaration form, the Named Assured field is a searchable dropdown. The participant types a few characters of the name, tax ID, or email; matching Business Partners with the Named Assured role are surfaced. The participant picks one.

If no match is found, the participant can click **Create new Named Assured** from within the dropdown — a modal opens with the minimum required fields:

- Name (legal name of the entity or individual).
- Country (ISO 3166-1 alpha-2, dropdown).
- Address (optional at creation, editable later).
- Tax ID or registration code (optional).
- Contact email (optional; used only if the assured receives claim notifications).
- Category — Person or Company.

On save, the modal closes and the newly-created Named Assured is selected on the shipment.

### Auto-create from bulk upload

When shipments are bulk-uploaded, the row processor looks up the Named Assured by name. If not found:

- If `BULK_UPLOAD_ALWAYS_CREATE_NAMED_ASSURED` is on — the row processor creates a Named Assured Business Partner with the minimum fields drawn from the spreadsheet row and continues booking.
- If the setting is off — the row fails validation with "Named Assured not found" and the batch summary flags it for manual review.

The auto-created assured is stored with the same role and category as a manually-created one; no downstream flow distinguishes between them.

### Named Assured on the certificate

Every certificate PDF prints the Named Assured's name, address, and tax ID or reference number where applicable. The wording template used to render the certificate binds these fields into the specific location the insurer's certificate layout requires — usually the "For the Account of" line, sometimes the "Assured" block.

If the Named Assured is edited after the certificate is generated (address correction, name typo fix), the certificate does not regenerate automatically. The broker or underwriter must trigger a re-issue from the shipment 360 Documents tab.

### Named Assured on referrals and claims

When a referral is raised on a shipment, the Named Assured appears in the shipment snapshot on the Referral Activity Page. This lets the underwriter see who is actually being insured and factor that into the decision (a high-profile customer may warrant a more lenient decision on an ambiguous decline reason, for example).

When a claim is opened on a shipment, the Named Assured is one of the notification recipients (see Claims). If the contact email is set on the assured record, they receive the claim intake acknowledgement directly; if not, notifications go only to the internal team.

## Options & choices

### Named Assured attribute fields

| Field | Required | Notes |
|---|---|---|
| Name | ✓ | Legal name; appears on certificates verbatim |
| Country | ✓ | ISO 3166-1 alpha-2 |
| Address (line 1, line 2, city, postal code) | Optional | Appears on certificates when present |
| Tax ID / registration code | Optional | Some insurers require it; check policy-specific configuration |
| Contact email | Optional | Used for claim notifications only |
| Contact phone | Optional | Reference only, not used for outbound |
| Category | ✓ | Person or Company |

### Named Assured actions

| Action | Who | Where |
|---|---|---|
| Search & select on shipment | Participant, Broker | Shipment declaration form |
| Create new inline | Participant, Broker | Shipment declaration form |
| Edit master record | Broker, Admin | Business Partner module |
| Deactivate | Admin | Business Partner module — removes from selectable lists but preserves historical shipments |
| Merge duplicate assureds | Admin | Business Partner module — rare; used when two Assured records for the same real-world entity were created independently |
| Re-issue certificate after edit | Broker, Underwriter | Shipment 360 Documents tab |

## Business rules & calculations

- **Named Assured is required on every shipment.** No quote without one.
- **Name goes on the certificate verbatim.** Typos matter; broker owns accuracy.
- **Deactivation is preferred over deletion.** Deleting a Named Assured would break historical shipments and certificates; the platform blocks it under normal conditions.
- **Auto-created assureds carry a flag** in the audit trail so admins can review the batch-created set and consolidate duplicates.
- **Cross-broker visibility is scoped.** A Named Assured created under broker A is not visible to broker B unless explicitly shared. This prevents accidental cross-broker exposure of customer names.
- **Merge is one-way.** Merging assured X into assured Y updates every historical shipment reference from X to Y and deactivates X. There is no unmerge.

## States & transitions

Named Assured is a Business Partner, so it follows the standard partner state model — Active or Inactive. There is no workflow-specific state machine.

| State | Meaning | Transitions |
|---|---|---|
| Active | Selectable on new shipments | → Inactive (via Deactivate) |
| Inactive | Not selectable on new shipments; historical shipments preserved | → Active (via Reactivate) |
| Merged | Master record merged into another; this record retired | Terminal |

## Related concepts

- Business Partner
- Quote Creation
- Bulk Upload
- Documents
- Referral Activity Page
- Claims
