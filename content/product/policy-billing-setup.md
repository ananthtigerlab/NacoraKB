# Policy Billing Setup

## What it is

The Billing step — Step 4 of the Marine Cargo policy wizard — defines the commercial pricing skeleton of the policy. It answers four questions: what currency is the policyholder invoiced in, what is the maximum insurable limit on any single shipment, when do invoices generate each month, and what additional charges are applied to every shipment premium under the policy.

These settings drive every quote and certificate issued under the policy. Switching the billing currency after activation is disruptive — it forces the rating tables to be reconfigured — so the broker confirms with the customer up front. Fixed-amount shipment charges are also currency-dependent, and a billing-currency change on a policy that already has fixed-amount charges will clear those charges and require the broker to re-enter them in the new currency.

## Who uses it & where

- **Brokers and Producers** — configure the Billing step during policy creation and can revisit it during an endorsement.
- **Rating** — reads the billing currency; every insured value on a shipment is converted into this currency before rating.
- **Business Rules** — the High Value Shipment Alert system rule reads the Maximum Insurable Limit configured here.
- **Finance (BMS side)** — receives the billing settings via the platform's downstream event stream; invoice generation itself happens outside this platform.

## How it works

### Prerequisites

Before opening the step:
- The billing currency has to be confirmed with the customer.
- The maximum insurable limit per shipment has to be known.
- The insured-value currencies participants are allowed to declare have to be decided (either the billing currency only, or a wider multi-select).
- Any shipment charges (broker fees, government levies, taxes, rebates) have to be agreed in advance — value type (fixed or percentage) and amount.

### Currency configuration

**Billing Currency.** Required. The currency in which premiums are invoiced. Selected from the Choices currency list. This currency also becomes the conversion target for every shipment's insured value at rating time.

**Insured Value Same as Billing Currency.** Optional checkbox. When ticked, shipments under the policy can only be insured in the billing currency and the multi-select for insured-value currencies is disabled.

**Insured Value Currencies.** Required when the checkbox above is unticked. Multi-select. Defines the set of currencies participants are allowed to declare insured value in on the shipment form.

### The Maximum Insurable Limit

Required. A hard cap on any single shipment's insured value. When a participant submits a shipment declaration whose insured value exceeds the cap, the platform raises a High Value Shipment Alert activity to the Producer.

The value is currency-denominated in the billing currency. Changing the billing currency after this value has been entered requires re-checking the amount is sensible in the new currency.

### Billing Date

Two mutually exclusive options for when invoices are generated each month:

- **Last day of the month.** The default. Invoices generate on whichever day is the last of the calendar month.
- **Specific day of the month.** A fixed day between 1 and 31. If the chosen day does not exist in a given month (for example 31 in February), invoicing falls back to the last day of that month.

### Shipment Charges

Optional. Up to eleven additional charges can be added to a policy — the first ten are user-defined charge rows, and an additional broker-level or system-level charge may sit above them. Each charge applies to every shipment premium under the policy.

For each charge the broker sets:
- **Charge Name.** A descriptive label used on the quote breakdown and certificate.
- **Charge Type.** Three options:
  - Tax — percentage only.
  - Rebate — percentage only (reduces the running subtotal).
  - Additional Charge — either percentage or a fixed amount in the billing currency.
- **Charge Value.** The percentage or the amount, depending on the charge type.

### How charges are calculated

Charges apply sequentially in the order they appear on the page. Each charge is calculated on the running subtotal after the previous charge has been applied — not on the original base premium.

Worked example.
- Base Premium = USD 1,000.
- Charge 1: 10 percent Tax = USD 100. Subtotal = USD 1,100.
- Charge 2: 10 percent Additional Charge on USD 1,100 = USD 110. Final Total = USD 1,210.

If the two 10 percent charges had been calculated on the base premium alone the result would have been USD 1,200. Because charges compound on the running total the platform arrives at USD 1,210. This distinction matters when the charge order is set.

### Reordering charges

Drag-and-drop the row handles to change the order of the charges. Because charges are calculated sequentially on the running subtotal, changing the order changes the final total when percentage and fixed charges are mixed, and when rebates are combined with taxes. The broker reviews the order carefully before saving.

### Flat vs percentage

- **Tax** charges are percentage-only.
- **Rebate** charges are percentage-only. A rebate reduces the running subtotal.
- **Additional Charge** is the flexible option — it can be a percentage or a fixed amount in the billing currency.

Fixed-amount charges are tied to the billing currency at the moment they are set. If the billing currency is later changed on the same policy, a confirmation message appears warning that the fixed amounts will be cleared and re-entered manually in the new currency.

### Effect on downstream

- Every quote breakdown shows the base cargo premium, each charge row's contribution, the running subtotal at each step, and the final total payable in the billing currency. The certificate shows the same breakdown depending on the Premium Information setting on the Certificate Document configuration.
- Rating always converts insured values into the billing currency before applying rates.
- The High Value Shipment Alert reads the Maximum Insurable Limit configured on this step.
- Finance on the BMS side picks up invoicing on the configured billing date.

## Business rules & calculations

- **Billing Currency is required.** Switching it after activation is disruptive and forces the rating tables to be reconfigured.
- **The Maximum Insurable Limit is currency-denominated in the billing currency.** Changing the billing currency requires re-checking this value.
- **Insured Value Currencies default to a multi-select.** The Insured Value Same as Billing Currency checkbox, when ticked, restricts to the billing currency only and disables the multi-select.
- **Billing Date supports up to day 31.** Days that do not exist in a given month fall back to the last day of that month.
- **Charges apply sequentially on the running subtotal, not on the base premium.** Order matters.
- **Up to eleven charge levels.** The typical setup is up to ten user-defined charge rows.
- **Tax and Rebate are percentage-only.** Additional Charge is either percentage or a fixed amount.
- **Fixed amounts are currency-tied.** A billing-currency change clears fixed amounts and requires manual re-entry.
- **Drag-and-drop reorders charge rows.** Reordering can change the final total when percentage and fixed charges are mixed.
- **The High Value Shipment Alert is driven by the Maximum Insurable Limit configured here.** No separate configuration is needed on Business Rules.

## Related concepts

- Policy Creation (New Business)
- Rating
- Business Rules
- Documents
- Billing
- Choices
