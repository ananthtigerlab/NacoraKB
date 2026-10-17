# FAQs & Knowledge Base

## What it is

FAQs are context-sensitive help entries surfaced inline in the product. When a user hovers or clicks the help icon next to a form label — say the "Coverage" dropdown — a small modal opens with a plain-English explanation of the concept ("ICC A is the broadest form of cargo insurance…"). Admins maintain the entries in the Backoffice; users see the icons wherever an FAQ has been attached to the relevant object.

## Who uses it & where

- **All users** — read-only, contextual on forms and object detail pages.
- **Content admins** create and edit FAQ entries in the Backoffice FAQ manager.

## How it works

1. Admin creates an FAQ entry with a title, a body (markdown supported, links allowed), and marks it Active.
2. Admin links the entry to one or more objects — a specific clause, a specific rule, a specific choice type. The link carries an ordering value so multiple FAQs can be shown in a predictable sequence.
3. When a page renders that has FAQs attached, a small icon appears next to the label. Clicking opens a modal with the FAQ content.
4. Full-text search across all FAQs is available from the Backoffice help centre.

## Business rules & calculations

- **Only Active entries are shown.** Deactivating an entry hides it everywhere without deleting it.
- **One FAQ can attach to many objects** — a single "ICC A explained" entry can appear next to every clause and every coverage-related field.
- **Ordering per attachment:** if multiple FAQs attach to the same object, they render in the order set on the relation.

## Related concepts

- Choices
- Clauses
- User Journeys & Screens
