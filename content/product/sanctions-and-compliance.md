# Sanctions & Compliance Screening

## What it is

**Sanctions and compliance screening** is the layer of automated checks that runs on every shipment before it is quoted, catching cargo, counterparties, and routes that touch sanctioned lists or embargoed jurisdictions. It exists because marine cargo underwriting carries direct regulatory exposure: quoting a policy on a cargo destined for a sanctioned country, or on behalf of a sanctioned counterparty, is a compliance breach regardless of whether the platform caught it.

Screening is not a separate module the user opens — it is a set of Business Rules that ship as system rules on every policy, plus supporting checks that run inside the rating pipeline itself. A shipment that trips any of these checks is either declined outright or referred to an underwriter with a specific compliance reason attached. The rules cannot be edited to be less strict; they can be edited to be *more* strict, and they are always active.

Three screening layers work together.

## Who uses it & where

- **Every user who books a shipment** — brokers in the Back Office, participants in the Shipment Portal, bulk uploaders — encounters compliance screening automatically. They do not opt in and they cannot bypass it.
- **Underwriters** review the referrals that sanctions rules produce. Compliance referrals are visually flagged in the referral queue so an underwriter can prioritise them over routine ones.
- **Administrators** configure the underlying data (sanctions keywords, embargo country lists) via the Choices module and monitor the audit trail. They do not typically create or delete sanction rules — those are system rules that ship with the platform.
- **Compliance and audit reviewers** rely on the audit trail entries every screening event produces. Every match is timestamped, attributed, and permanent.

Screening happens inside the rating flow, so the surface where a user sees it is the shipment form (a referral card appears when a rule matches) and the referral activity page (where the specific reason is shown).

## How it works

### The three screening layers

**1. Cargo description sanction check.** A free-text scan of the shipment's cargo description looking for indicators of sanctioned or prohibited goods. This runs against every shipment regardless of policy configuration. The scan uses a hosted large-language model (running on AWS Bedrock with Cohere-family models) so that it can catch paraphrasing and category-level references, not just exact keyword hits. If the description contains language that flags a potential sanctions concern, the shipment is referred to an underwriter with the specific match highlighted. The check does not decline shipments outright — the failure mode is *refer for human review*, because false positives are more tolerable than false negatives, and a human can distinguish a legitimate reference from a real hit.

**2. Named-assured sanction check.** The shipment's Insured, Consignor, and Consignee (and any other named counterparties captured on the booking form) are checked against known sanction lists. If a match is found — for example the Consignee's name matches an entry on a sanctions list — the shipment is referred. This is the check most likely to catch a compliance breach because sanctioned parties tend to appear by name; keyword scans on cargo descriptions are the safety net.

**3. Departure and destination embargo check.** The shipment's origin country and destination country are checked against the platform's embargo list. Today that list is North Korea, Iran, and Syria; it is configurable per deployment. A shipment with either endpoint on the list is referred. Transit through an embargoed country (as opposed to origin or destination) is not currently detected — this is a known gap.

Each layer is implemented as a **Business Rule** on the policy, categorised as Referral, in the sanctions category. The specific rules are:

- **Cargo Description Sanction Check** — the free-text scan.
- **Departure Embargo Check** — origin country against embargo list.
- **Destination Embargo Check** — destination country against embargo list.
- **Sanction check** — the named-assured lookup.

All four rules are active by default and evaluate against every shipment regardless of the policy's overall rule mode.

### Integration with shipment rating

Screening is not a separate step. When a shipment is submitted for a quote, the rating pipeline runs the sanctions rules alongside the other Business Rules. If a sanction rule matches, a referral is created; the shipment does not receive a quote until the underwriter clears the referral. If no sanction rule matches, the rating proceeds normally.

The order of evaluation matters. Sanctions rules run first, before commercial rules like minimum premium or rate override. This means a sanction hit surfaces before the platform spends effort computing a premium the shipment can never be quoted at. It also means the audit trail records the sanction event first, which is what a compliance reviewer needs.

### Special Rate approval and the sanctions-only bypass

Special Rates are negotiated overrides — a specific rate for a specific counterparty on a specific route, approved by an underwriter. When an underwriter approves a Special Rate, they now choose how the platform should treat other Business Rules for shipments matching that rate. Three options are presented before approval:

- **Apply all Policy Business Rules.** Every rule on the policy is evaluated, exactly as it would be for a normal shipment. This is the default and the safest option.
- **Apply sanctions-related rules only.** Only the four sanctions and compliance rules run. All other rules — minimum premium, referral triggers on commodity, high-value thresholds, and so on — are bypassed. This is the mode for Special Rates that were pre-negotiated with all the commercial considerations already baked in, but where compliance screening must still apply.
- **Always refer.** Every shipment matching the Special Rate is referred to an underwriter, regardless of what the rules say. This is used when the Special Rate is provisional or the underwriter wants to see every shipment before it books.

The middle option — **sanctions-only bypass** — is the important one for compliance. It exists so that a pre-negotiated bespoke rate does not skip sanctions screening. An underwriter cannot design a Special Rate that bypasses sanctions checks. The three sanction-category rules always evaluate, even when the rest of the rule set is disabled.

When "Always refer" is chosen, a system Business Rule named **Special Rate** is created on the policy, in the Referral category, with the action Refer and the reason "Referred due to special rate applied." This makes the referral traceable back to the choice made at approval time.

### The AI model behind cargo description screening

The cargo description sanction check uses a hosted large-language model running on AWS Bedrock, in the Cohere family. Functionally, this means the check is fuzzy rather than exact — a description that says "materials used in nuclear enrichment" is caught even without any single keyword being on a hardcoded list. The trade-off is that some legitimate descriptions will occasionally trip the check (false positives). Because the outcome of a match is *refer to underwriter*, not decline, false positives are absorbed as extra review effort rather than as blocked shipments.

The model is not user-configurable. If the check produces recurring false positives on a specific legitimate cargo category, the fix is to add whitelisted phrasing to the Choices module (the tunable list of examples for commodity classification) rather than to modify the model. This has parallels to how the Commodity Group Suggestion feature is tuned — accuracy comes from example data, not from code changes.

### Audit trail integration

Every sanction rule match produces an audit trail entry against the shipment, the referral, and (where relevant) the counterparty record. The entry includes the rule name, the specific match (the exact phrase caught, the exact name matched, the country matched), the timestamp, and the user account under which the shipment was submitted. Audit entries are append-only — they cannot be edited or deleted, even by administrators. Compliance reviewers can retrieve the audit trail for any shipment via the audit trail sidebar, and (via a work-in-progress enhancement) filter by date range, action type, and person, and export the filtered view to CSV.

### Regulatory implications

Sanctions screening on NacoraHub is designed to be defensible. Every check runs, every match is logged, every decision is attributable. If a regulator asks how a specific shipment was screened, the audit trail provides the answer without requiring reconstruction from application logs. The screening cannot be silently bypassed — there is no "turn off sanctions" toggle. This is by design and by regulatory necessity: the platform is used to place cargo insurance for Nacora, a Kuehne+Nagel insurance business, and the compliance posture reflects the regulatory obligations of the K+N group.

The one part of the picture that is not the platform's responsibility is *keeping the sanctions lists current*. The lists themselves are external data feeds that must be refreshed on an appropriate cadence. Which specific lists are integrated (OFAC, UN, EU, national lists) and how often they refresh is an open configuration point per deployment.

## Business rules & calculations

- **Sanctions rules always evaluate.** The policy-level rule modes ("Apply all", "Sanctions only", "Always refer") change what happens with *non-sanction* rules; the sanction rules run in every mode.
- **Special Rate approval offers a sanctions-only mode.** Underwriters explicitly choose whether an approved Special Rate should bypass commercial rules while still running compliance checks.
- **Matches produce referrals, not declines.** The default outcome is human review. A shipment can be booked after a sanction match only when an underwriter clears the referral with a documented reason.
- **The audit trail is append-only.** Even correcting a mistaken match produces a new audit entry; the original match record remains.
- **Transit-through-embargo is not detected today.** Only origin and destination countries are checked against the embargo list; a shipment routed through an embargoed country without listing it as an endpoint will not trip the embargo rule.
- **The cargo description model runs on AWS Bedrock (Cohere family).** Functional behaviour: fuzzy, semantic matching rather than exact keyword lookup. Practical implication: expect occasional false positives, tuned via example data rather than code.

## Related concepts

- Business Rules
- Special Rate
- Referral Management
- Audit Trail Module
- Commodity Group Suggestion
- Choices
