# Documents

## What it is

The Documents area turns policy and shipment data into branded PDFs. Two document types are produced under a Marine Cargo policy: the Quote document, issued before booking and expiring after thirty days, and the Certificate of Insurance, issued after booking and serving as the proof-of-cover the insured presents to banks, customs, and counterparties.

Each PDF is generated from a template that is versioned in the platform, with live variable interpolation, multi-language support, and a QR code that links back to a digital copy. During policy creation, two dedicated configuration steps set up the templates for the specific policy — the Quote Document step and the Certificate Document step — and both share the same underlying editing surface, the Document Editor. The editor only changes the per-policy template; the platform's global default template is unaffected.

The certificate is the single most-scrutinised document the platform produces. Errors caught at the preview stage cost minutes; errors caught after a shipment is booked can cost much more.

## Who uses it & where

- **Brokers and Producers** — during policy configuration set the templates, language, and QR settings via the two configuration steps. After activation they can adjust the per-policy template through an endorsement, which creates a new template version.
- **Participants on the Shipment Portal** — generate the Quote PDF from a quote screen and receive the Certificate PDF once the shipment is booked.
- **Document administrators** — manage the deployment-wide default templates in the Back-Office.
- **The system itself** — auto-generates documents on demand when a quote is issued or a shipment is booked.

## How it works

### The two configuration steps

Both Quote Document and Certificate Document configuration steps follow the same pattern. Each has:

- A blue info alert explaining the goal of the step.
- A Set Up button that opens the Document Editor.
- A Mark as Complete button that becomes active once the prerequisites are met.

A step is not considered complete until the broker clicks Mark as Complete. Green checks on the wizard sidebar appear only on explicitly-completed steps. Filling in the underlying editor is necessary but not sufficient. Neither step can be marked complete without the editor being opened and saved at least once.

Both steps have to be visited even if the deployment's default template is acceptable, because the policy cannot activate until every configuration step is complete.

### Step 6 — Quote Document

The PDF participants receive when their shipment is rated. Every quote produced under this policy renders through whichever template version is published here.

Opened via Set Up Quote Document on the info card. The editor loads with the current template for the policy. Sections configured on the Quote include:

- **Document Title** — the title at the top of the document.
- **Branding** — the Primary Logo (required) and an optional Secondary Logo.
- **General Enquiries** — company name, address, contact email, phone or fax.
- **Claims Enquiries** — contact details for claims.
- **Disclaimer** — a default is pre-filled and can be edited.
- **Terms and Conditions** — a default is pre-filled and can be edited.
- **Clause Court of Jurisdiction** — a default is pre-filled and can be edited.
- **Footer** — up to twelve key-value entries for company name, registration number, legal notes, and similar.

Update refreshes the preview. Preview in Language checks rendering in any of the supported certificate languages. Save and Exit returns to the wizard, where the broker clicks Mark as Complete on the step page.

### Step 7 — Certificate Document

The Certificate of Insurance. Layout and editor are the same as the Quote Document; the templates themselves are independent.

Sections specific to the certificate:

- **Premium Information** — controls what premium value prints on the certificate. Options: Cargo Premium (the base premium alone), Total Cost (the full premium after charges), Total Cost minus Rebate, or the literal word Paid with no amount. The premium-rate line can also be hidden entirely.
- **Settling Agent Information** — company name, address, email, contact number, fax.
- **Signatures** — Signature 1 is required (name, title, signature image — all mandatory). Signature 2 is optional.
- **Instructions** — the text that appears on the page reached via the QR code or embedded link on the certificate.
- **Clause Court of Jurisdiction** — default pre-filled and editable.
- **Footer** — up to twelve key-value entries.
- **Certificate Language** — one default language is required; a second language is optional. When a second language is set both versions render inside a single PDF as a bilingual certificate.

Save and mark the step complete once the template has been previewed. Previewing the rendered certificate before marking complete is strongly recommended.

### The Document Editor

The shared editing surface used by both the Quote Document and the Certificate Document configuration steps. Its job is to adapt the deployment's PDF template for a specific policy — adding or rearranging sections, editing field values, and previewing the result side-by-side as the broker works.

**Two panes.**
- Left pane, the Template Navigator — drag-to-reorder sections of the document, add or remove sections.
- Right pane, the Live PDF Preview — regenerates the PDF as the broker edits, shows the current language, and provides a toggle when a secondary language is configured.

**Adding, reordering, and editing sections.**
- Add Section in the Template Navigator inserts a section from the template library.
- Dragging a section by its handle moves it up or down.
- Clicking a section expands its fields.
- Editing field values happens inline — most accept text, dropdown choices, or conditional logic.
- Save persists in-progress work.

Common section types include the policy header (parties, dates, contract number), coverage summary, schedule of risks, premium summary, terms and conditions with institute clauses, and signature blocks. Exact section types depend on what the deployment has configured; templates are deployment-specific.

**Language switching.** If the policy has a secondary language configured, a language toggle appears at the top right of the preview pane. Clicking it re-renders the preview in the chosen language. Editing remains tied to the section, not the language; translations are handled by the field-level translation panel inside each section.

**Publish flow.** Save preserves in-progress work — the configuration step in the wizard shows In Progress. Publish (or the equivalent submit action) marks the template ready — the configuration step becomes eligible for Mark as Complete.

**Preview timing.** The preview re-renders on a debounce, so a short delay is expected between the edit and the visible change.

### From setup to a live document

When a quote or a certificate is requested for a specific policy version and shipment, the platform resolves the correct template — the latest active version for the policy unless a specific version is requested. Data is bound into the template: policy attributes, shipment attributes, the full pricing breakdown, the attached clauses, and the applicable Insuring Conditions text. Translations are applied based on the recipient's language preference — English, French, German, Spanish, Japanese, Chinese, Turkish, or Portuguese — which pulls the matching translation file for the template body and the clause text.

A QR code is generated and embedded in the margin. The QR links to a digital copy of the document on the Shipment Portal. Each shipment keeps a short history of QR tokens (up to fifty) to avoid unbounded growth.

The HTML is rendered to PDF and saved as an attachment linked to the shipment. A live preview using the same rendering path is available as HTML (not PDF) so brokers can preview a Quote before committing.

### Template versioning

Editing a template creates a new version. Old versions stay accessible for shipments that were issued against them. Publishing a new document version from an endorsement creates that new version and does not disturb existing shipments — a shipment already generated against a prior document version continues to display that older template; new shipments after the effective date use the new template.

Known limitation: there is no discard for scheduled versions. If a broker publishes a new version by mistake, the workaround is to publish another version on top of it. This is a UX gap flagged in the platform knowledge transfer.

### Export format selection

Every export flow that produces a downloadable file — the Shipments dashboard export, the Billing reports export, the Referrals audit-trail export, and the various dashboard reports — presents an **Export** dialog with a format toggle for **CSV** or **XLSX** (from I2G-30007). CSV is the lightweight machine-readable option; XLSX carries column formatting, wider column headers, and is more suitable for handing directly to a finance analyst. The user picks whichever suits the downstream consumer and the file is generated on the fly.

### Shipment report additions

The shipment report has grown to include additional columns beyond the original set (from I2G-29713). New columns cover fields that Nacora's operations teams asked for during KT — the confirmed additions surface additional risk-detail and commercial fields that the standard report was missing. The columns are visible in both CSV and XLSX exports.

### Certificate number field

The certificate form supports changing the certificate number on demand (from I2G-30154). The default number comes from the platform's numbering sequence (see Numbering); the field is editable at the point of issuance if the underwriter needs to align with an external reference. Sequences are still tracked centrally per I2G-29882 so numbers cannot silently collide.

### Policy duplication — template persistence

When a policy is duplicated, its **Quote Document** and **Certificate Document** template configurations are carried over correctly to the copy (from I2G-30110). The templates retain their activation state — an active template on the source produces an active template on the copy, and an in-progress template stays in progress. This fix closed a gap where duplicated policies would land with the default template instead of the source's bespoke template, forcing the broker to rebuild it manually.

## Business rules & calculations

- **Insuring Conditions attach automatically** based on the coverage type selected — the ICC A, B, and C rules each pick their own clause set.
- **Premium breakdown always shown** on every Quote: cargo premium, each charge level, total payable, FX rate used, and the base-currency equivalent.
- **Certificate timing:** only issued once the shipment status is Booked or Endorsed. Certificates cannot be generated on a still-quoted shipment.
- **Quote expiry:** default thirty days from generation. An expired Quote cannot be booked and the shipment has to be re-rated.
- **PDF generation is on demand.** There is no background job creating PDFs automatically; they are built the moment they are requested.
- **Template versioning:** editing a template creates a new version. Old versions stay accessible for shipments that were issued against them.
- **Both configuration steps must be visited.** Even if the default template is acceptable, opening and saving is required before the step can be marked complete.
- **Preview before marking complete.** The certificate is the most-scrutinised document; a preview at each language is expected.
- **Global default is not touched.** The editor only changes the per-policy override; the deployment's global default template is unaffected by policy-level edits.
- **Bilingual certificates render in one PDF.** When a secondary language is configured on General Details, both language versions appear inside the same PDF file.
- **Supported languages** at the deployment level: English, French, German, Spanish, Japanese, Chinese, Turkish, Portuguese.
- **QR token history capped at fifty per shipment.** Beyond that, oldest tokens are dropped to prevent unbounded growth.

## Related concepts

- Configuration Steps Overview
- Clauses
- Quote Creation
- Rating
- Numbering
- Mail Notifications & Templates
