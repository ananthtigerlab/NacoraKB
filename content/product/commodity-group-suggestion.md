# Commodity Group Suggestion

## What it is

The Commodity Group Suggestion is the AI-assisted classifier that turns a free-text cargo description into a shortlist of matching commodity groups on the shipment form. Rather than presenting a long dropdown of predefined categories, the platform asks the participant to describe what they are shipping ("laptop screens for Dell", "frozen prawns Vietnam to Rotterdam", "wine cases from Bordeaux") and returns the top matching commodity groups for them to confirm.

The suggester exists because commodity classification is the single most error-prone step in cargo submission. A wrong classification produces the wrong rate. A dropdown of dozens of groups with technical names asks a lot of participants who just want to book a shipment. The AI suggester keeps the interface as a plain text field but does the mental mapping for the user, and it does so using the policy's own commodity group configuration as the target set.

## Who uses it & where

- **Participants** in the Shipment Portal, at the commodity field on the shipment creation form.
- **Broker staff** in the Back Office when creating shipments manually.
- **Underwriters** during referral review — they can see what free-text the participant typed and which commodity group the participant confirmed.
- **Analytics** tracks the classification quality — how often the top suggestion is accepted, how often the user overrides it, how often the fallback fires.

The suggester is only used for policies whose policyholder has the Nature of Business set to **Freight Forwarder**. For those holders, commodity groups are auto-generated from the Choices list, and the AI suggestion runs over that list on every shipment. For policyholders whose Nature of Business is **Shipper / Consignee**, commodity groups are defined manually on the policy's Risks step and the AI suggester is not used — participants pick from the small, deliberate manual list instead.

## How it works

### The user experience

- The participant types a free-text description of what they are shipping into the commodity field on the shipment form.
- The classification service runs behind the scenes and returns a ranked list of commodity group suggestions.
- The top few are shown to the user in the field's dropdown. The top result is pre-selected.
- The user confirms the pre-selection, edits the description, or picks a different suggestion from the list.
- Whatever is confirmed becomes the shipment's commodity group and is used by the rating engine as the commodity key.

### The classification pipeline

Behind the field, the classification service builds a prompt for a large language model (AWS Bedrock) and sends the following context:

- The full list of commodity groups the policy makes available. This is the auto-generated list from Choices for Freight Forwarder policyholders. It travels into the prompt as name plus description plus example items (the "seed examples") for each group.
- A set of **brand keyword hints** — Nacora-specific rerank hints that bias classification toward the correct group when brand or product names would otherwise confuse the model. Examples include "ThinkPad", "X1 Carbon", "MacBook", "iPad", "iPhone", and "ECU" all pulling toward the appropriate group (Consumer Electronics or Automotive). These hints are what make the classifier reliable on niche items whose free-text descriptions do not contain the category word (from I2G-29747).
- The user's free-text description.

Bedrock returns a ranked JSON list of suggestions with reasoning. The classification service parses that list, drops anything invalid, and returns the top few to the shipment form.

**Two-stage ranking.** The classifier runs in two stages for higher precision than a single Bedrock call would produce (from I2G-29747):

- **Stage 1 — Vector recall.** A vector similarity search over the commodity group corpus quickly identifies a broad candidate set of possibly-relevant groups. This is the recall stage — cast a wide net, tolerate false positives.
- **Stage 2 — Cohere Rerank precision.** A cross-encoder reranker (Cohere Rerank) takes the candidate set from stage 1 and scores each candidate against the user's free-text description with much higher precision than the vector layer can offer alone. The reranker's ordering is what the user sees in the dropdown.

An optional **min_score** parameter can be applied to filter out low-confidence candidates from the final list — set it higher and the dropdown only shows suggestions the reranker is confident about; leave it at the default and low-confidence matches still appear so the user has options.

### Fuzzy search on commodity descriptions

The fuzzy search that supports the commodity field now indexes the commodity **description** in addition to the category name (from I2G-29586). Typing "wine" therefore finds Beverages even if the category name is not literally "Wine" — the match hits the description text. Alongside the fuzzy search improvement, the form field ordering was optimised for the shipment writer's workflow (commodity selection surfaces earlier so downstream fields depend cleanly on it).

### Falling back gracefully

If Bedrock times out, errors, or is unreachable, the pipeline falls back in two steps:

- First, embedding-based similarity search over the same commodity group list. This produces a less nuanced ranking but is fast and requires no external service.
- Second, an empty list. The user simply sees no AI suggestions in the dropdown and can still pick manually from the underlying commodity group choices.

There is no error toast. The manual dropdown remains fully functional whether Bedrock succeeds or not. This design choice keeps the shipment form usable when the AI layer is unavailable, and it keeps failures invisible to the participant.

### Why seed examples matter

The quality of the seed examples on each commodity group record is the single biggest driver of classification accuracy. Nacora provided an Excel file of real-world cargo descriptions grouped by category — Beverages includes "milk", "juice", "wine cases", "energy drinks"; Consumer Electronics includes branded product names; and so on. Those examples are seeded onto the commodity group records and included in every Bedrock prompt.

The practical implication observed during KT: a live demo of the word "beverage" as free-text failed to suggest the Beverages group because that specific token was not present in the seed examples. The fix was not a code change. It was adding "beverage" to the Beverages group's example list. This is a **living, tunable list** that improves with usage — the more real-world submissions administrators observe, the more they can enrich the seed data, and the more accurate future classifications become.

The Nacora tenant has roughly 16 core commodity categories at seeding time (Beverages, Antique Art, Consumer Electronics, Pharmaceuticals, and others), and each carries its own seed example list.

### Relationship to Nature of Business

For a policyholder whose Nature of Business is Freight Forwarder, the Commodity Group tab of the policy's Risks step is auto-populated from Choices. The AI suggester operates against that generated list on every shipment.

For a policyholder whose Nature of Business is Shipper / Consignee, the Commodity Group tab is manually configured — the administrator enters commodity group names and descriptions directly. Those manually defined groups become the only options the participant sees in the shipment form, and the AI-assisted suggester is not consulted. Presumably a shipper managing a narrow, well-known cargo profile does not need the AI layer; the manual dropdown is small enough to browse.

Changing the policyholder's Nature of Business after the Commodity Group tab has already been configured will prompt to clear the existing commodity groups on the tab, because the auto-generated and manually defined lists cannot coexist.

### Note on documentation coverage

The official product documentation covers the *policy-level* commodity group configuration in detail — how the tab behaves for Freight Forwarder vs Shipper / Consignee, how the AI suggester is enabled or disabled depending on that choice, and how commodity groups flow into rating. It does not include a dedicated page for the AI suggester's classification pipeline itself — the Bedrock prompt structure, the rerank keyword list, the fallback chain, or the temperature setting. The information on this page about how the AI classifier works internally is derived from platform code and knowledge-transfer sessions rather than from a documented product surface. This is a documentation gap rather than a product gap.

### Manual-fallback design footnote

An earlier design proposal for a manual-fallback suggestion feature (a mechanism to surface manually-curated suggestions when the AI layer is unavailable, distinct from the silent empty-list fallback described above) has been **dropped from scope** as obsolete (I2G-29846). The current silent-fallback behaviour is the accepted design — participants who need to pick manually rely on the underlying dropdown rather than a separate curated-suggestion path.

## Business rules & calculations

- **Between 3 and 10 suggestions are returned per query**, depending on how many meaningful matches exist against the commodity group list.
- **Rerank keywords override raw text intuition.** Even if the free-text description would not obviously fit a category, matching one of the branded rerank keywords will pull the suggestion toward the correct group. This is critical for consumer electronics, where product names often do not literally include the word "electronics".
- **Temperature 0.3 for determinism.** The Bedrock call runs at a low sampling temperature so the same description reliably produces the same ranked suggestions across attempts. This is important for reproducibility — a participant redoing a shipment should not get different suggestions each time.
- **Silent fallback.** If Bedrock is unavailable, the participant sees no AI suggestions but the manual dropdown remains fully usable. No error toast fires.
- **Freight Forwarder only.** Shipper / Consignee policyholders bypass the AI suggester entirely and see only the manually configured commodity groups.
- **Seed data is tunable in production.** Refreshing the seed examples on a commodity group is a live-updatable operation — no redeploy required — and is expected to be done periodically from real shipment traffic. The recommended maintenance cycle is to review the top rejected suggestions and add missing tokens to the appropriate categories.
- **The confirmed commodity group is what the rating engine sees.** Whether the user accepted the top AI suggestion or picked something else from the dropdown, the value that ends up on the shipment is the commodity identifier the rating engine uses for its lookup. The free-text description is preserved on the shipment record for audit and for referrals, but it is not consulted by the rating engine.

## Related concepts

- Choices
- Rating
- Rating Lookup Tables
- Quote Creation
- Business Rules
- Third Party Integrations
