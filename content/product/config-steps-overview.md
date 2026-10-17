# Configuration Steps Overview

## What it is

After the Quote Configuration phase of the Marine Cargo policy wizard is complete — General Details through Risks, Steps 1 to 5 — the policy enters the Configuration Steps phase. There are five configuration steps, and each has to be explicitly marked complete before the policy can be activated.

The phase exists so that activation is a deliberate, audited action rather than a side-effect of filling in a form. Every step has the same underlying pattern: a short info card explaining the goal of the step, a Set Up button that opens the relevant editor, and a Mark as Complete button that becomes active once the prerequisites are met. The completion state is what the wizard sidebar reads — green checks appear only on explicitly-completed steps. Simply filling in the underlying editor is necessary but not sufficient.

## Who uses it & where

- **Brokers and Producers** — complete each of the five steps as part of policy setup. Revisit any of them during an endorsement, in which case a new version of the underlying artefact (document template, rate table, clause set, or rule set) is created.
- **Administrators** — maintain the deployment-wide defaults that seed each step, particularly the default document templates and the Global Clauses Library.
- **Underwriters** — occasionally sign off on the Rating step for policies configured as manual-sign-off.

## How it works

### The five steps

Each of the five configuration steps has its own dedicated page in the wizard.

- **Quote Document.** Opens the quote document editor for this policy — the PDF template used to issue quotes to participants. Every quote produced under this policy renders through whichever template version is published here. Detailed on the Documents page.
- **Certificate Document.** Opens the certificate document editor — the PDF template used as the proof-of-cover document on booked shipments. Layout and editor are shared with the Quote Document step, but the templates are independent. Detailed on the Documents page.
- **Rating.** Sets up the pricing logic. Every shipment quoted under the policy is rated using the configuration built here. Includes Lookup Tables (Routes and Commodity Groups), Rating Factors, and the permutation grid of rates and minimum premiums.
- **Clauses.** The wording attached to quotes and certificates. Import from the Global Clauses Library, add custom clauses specific to the policy, and reorder for how they appear on documents. Gated — the step cannot be marked complete until at least one clause is configured.
- **Business Rules.** The automated conditions that fire on every shipment submission. Includes the eighteen pre-loaded system rules (conditions fixed, values configurable) plus any custom rules the broker adds. Gated — the step cannot be marked complete until at least one rule is configured.

### The Mark as Complete pattern

Every Configuration Step page has the same shape:

- A blue info alert explaining the goal of the step.
- A Set Up button that opens the relevant detailed editor.
- A Mark as Complete button, active once the prerequisites for that step are met.

A step is not considered complete until the broker clicks Mark as Complete. The wizard sidebar reflects this — green checks appear only on explicitly-completed steps. Filling in the underlying editor is necessary but not sufficient. Some steps have preconditions before the Mark as Complete button becomes clickable at all: the Quote Document and Certificate Document buttons only activate after the editor has been opened and saved once, and the Clauses and Business Rules buttons only activate after at least one entry has been configured.

### Recommended order

The wizard does not strictly enforce an order between the five steps, but the recommended order matches the sidebar:

1. Quote Document.
2. Certificate Document.
3. Rating.
4. Clauses.
5. Business Rules.

Documents come first because several of the later steps surface settings that ultimately print on those documents (rates on the quote, clauses on both).

### Getting to activation

Once every step is marked complete and the wizard sidebar shows five green checks in the Configuration Steps phase (plus the five for the Form Steps phase), the policy is eligible for activation. Activation itself does not happen inside the wizard — the broker clicks Save and Exit to land on the policy's detail page, checks the completion indicator has reached 100 percent, opens the three-dot Actions menu, and selects Activate Policy.

## Business rules & calculations

- **Every configuration step must be explicitly marked complete.** Filling in the underlying editor is not enough.
- **Clauses and Business Rules are gated.** Neither step can be marked complete until at least one clause (Clauses step) or rule (Business Rules step) has been configured. The completion button is disabled with an explanatory tooltip until the prerequisite is met.
- **The Quote and Certificate Document steps require the editor to be opened and saved at least once** before Mark as Complete becomes available.
- **Rating completion is policy-specific.** For most policies it confirms the rate matrix matches the configured coverages and conveyance types. For others it is a manual sign-off — the deployment decides which model applies.
- **Activation does not happen inside the wizard.** It runs from the policy detail page after Save and Exit, using the three-dot Actions menu, and only when the completion indicator is at 100 percent.

## Related concepts

- Policy Creation (New Business)
- Documents
- Rating
- Clauses
- Business Rules
- Policy Lifecycle
