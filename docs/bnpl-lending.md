<!-- Generated from schemas/bnpl-lending.yaml by tools/render-md.ts. Do not edit. -->
# BNPL & Lending

> Installment plans, accrual, write-off, merchant settlement.

`bnpl` · `lending` · `collections`

**15 accounts · 10 transactions · 19 queries**

## Chart of accounts

- `borrowers`
  - `$borrowerId`
    - `.pattern`
    - `.self` _(bookable account)_
    - `plans`
      - `$planId`
        - `.pattern`
        - `.self` _(bookable account)_
        - `installments`
          - `$seq`
            - `.pattern`
            - `principal`
              - `outstanding`
              - `paid`
              - `writtenOff`
            - `interest`
              - `accrued`
              - `earnedNotCollected`
              - `paid`
            - `fees`
              - `accrued`
              - `earnedNotCollected`
              - `paid`
- `counterparties`
  - `merchants`
    - `$merchantId`
      - `.pattern`
      - `payable`
  - `psp`
    - `$pspId`
      - `.pattern`
      - `collections`
        - `pending`
- `platform`
  - `banks`
    - `$bankId`
      - `.pattern`
      - `operating`
  - `revenue`
    - `interest`
    - `fees`
      - `late`
      - `merchantDiscount`
    - `.self` _(bookable account)_

## Transactions

### `MERCHANT_PURCHASE_FINANCED`

Originate a financed purchase: book per-installment principal receivables, accrue the merchant payable net of the merchant discount fee, retain the discount fee as revenue.

interpreter: `experimental`

```numscript
vars {
  account $borrower_id
  string $plan_id
  account $merchant_id
  monetary $principal_1
  monetary $principal_2
  monetary $principal_3
  monetary $principal_4
  monetary $merchant_discount_fee
}

send [USD/2 *] (
  source = {
    max $principal_1 from @borrowers:$borrower_id:plans:$plan_id:installments:1:principal:outstanding allowing unbounded overdraft
    max $principal_2 from @borrowers:$borrower_id:plans:$plan_id:installments:2:principal:outstanding allowing unbounded overdraft
    max $principal_3 from @borrowers:$borrower_id:plans:$plan_id:installments:3:principal:outstanding allowing unbounded overdraft
    max $principal_4 from @borrowers:$borrower_id:plans:$plan_id:installments:4:principal:outstanding allowing unbounded overdraft
  }
  destination = {
    max $merchant_discount_fee to @platform:revenue:fees:merchantDiscount
    remaining to @counterparties:merchants:$merchant_id:payable
  }
)

set_tx_meta("event_type", "merchant_purchase_financed")
set_tx_meta("plan_id", $plan_id)
set_tx_meta("merchant_id", $merchant_id)
```

### `INTEREST_ACCRUAL`

Accrue interest on one installment to the receivable and the earned-not-collected memo; recognize no revenue (earned-on-collection model).

interpreter: `experimental`

```numscript
vars {
  account $borrower_id
  string $plan_id
  string $seq
  monetary $interest_amount
}

send $interest_amount (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:accrued allowing unbounded overdraft
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:earnedNotCollected
)

set_tx_meta("event_type", "interest_accrual")
set_tx_meta("plan_id", $plan_id)
set_tx_meta("installment_seq", $seq)
```

### `LATE_FEE_ASSESSED`

Assess a late fee on one installment to the receivable and the earned-not-collected memo; recognize no revenue until collected.

interpreter: `experimental`

```numscript
vars {
  account $borrower_id
  string $plan_id
  string $seq
  monetary $fee_amount
}

send $fee_amount (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:accrued allowing unbounded overdraft
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:earnedNotCollected
)

set_tx_meta("event_type", "late_fee_assessed")
set_tx_meta("plan_id", $plan_id)
set_tx_meta("installment_seq", $seq)
```

### `INSTALLMENT_COLLECTION`

Collect an installment via PSP card autopay; apply fee-interest-principal waterfall; recognize collected interest and fees as revenue (earned-on-collection).

interpreter: `experimental`

```numscript
vars {
  account $borrower_id
  string $plan_id
  string $seq
  account $psp_id
  monetary $payment
  monetary $fees_outstanding = overdraft(@borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:accrued, USD/2)
  monetary $interest_outstanding = overdraft(@borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:accrued, USD/2)
}

send $payment (
  source = @counterparties:psp:$psp_id:collections:pending allowing unbounded overdraft
  destination = {
    max $fees_outstanding to @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:paid
    max $interest_outstanding to @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:paid
    remaining to @borrowers:$borrower_id:plans:$plan_id:installments:$seq:principal:paid
  }
)

send $fees_outstanding (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:paid
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:accrued
)

send $interest_outstanding (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:paid
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:accrued
)

send [USD/2 *] (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:principal:paid
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:principal:outstanding
)

send $fees_outstanding (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:earnedNotCollected
  destination = @platform:revenue:fees:late
)

send $interest_outstanding (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:earnedNotCollected
  destination = @platform:revenue:interest
)

set_tx_meta("event_type", "installment_collection")
set_tx_meta("plan_id", $plan_id)
set_tx_meta("installment_seq", $seq)
```

### `INSTALLMENT_COLLECTION_RETURN`

Reverse a returned or charged-back installment collection; restore receivables, remove PSP-float cash, reverse recognized interest and fee revenue.

interpreter: `experimental`

```numscript
vars {
  account $borrower_id
  string $plan_id
  string $seq
  account $psp_id
  monetary $fees_collected
  monetary $interest_collected
  monetary $principal_collected
  string $original_posting_id
}

send $fees_collected (
  source = @platform:revenue:fees:late allowing unbounded overdraft
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:earnedNotCollected
)

send $interest_collected (
  source = @platform:revenue:interest allowing unbounded overdraft
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:earnedNotCollected
)

send $fees_collected (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:accrued allowing unbounded overdraft
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:paid
)

send $interest_collected (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:accrued allowing unbounded overdraft
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:paid
)

send $principal_collected (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:principal:outstanding allowing unbounded overdraft
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:principal:paid
)

send [USD/2 *] (
  source = {
    max $fees_collected from @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:paid
    max $interest_collected from @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:paid
    max $principal_collected from @borrowers:$borrower_id:plans:$plan_id:installments:$seq:principal:paid
  }
  destination = @counterparties:psp:$psp_id:collections:pending
)

set_tx_meta("event_type", "installment_collection_return")
set_tx_meta("plan_id", $plan_id)
set_tx_meta("installment_seq", $seq)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $original_posting_id)
```

### `PSP_REMITTANCE`

PSP settles collected card payments into the operating bank; clear the PSP collection float, grow the operating-bank backing.

interpreter: `experimental`

```numscript
vars {
  account $psp_id
  account $bank_id
  string $remittance_id
  monetary $amount
}

send $amount (
  source = @platform:banks:$bank_id:operating allowing unbounded overdraft
  destination = @counterparties:psp:$psp_id:collections:pending
)

set_tx_meta("event_type", "psp_remittance")
set_tx_meta("remittance_id", $remittance_id)
```

### `MERCHANT_WEEKLY_SETTLEMENT`

Settle a merchant's accrued payable weekly by ACH from the operating bank; drain the payable to zero.

interpreter: `experimental`

```numscript
vars {
  account $merchant_id
  account $bank_id
  string $settlement_id
  monetary $amount = balance(@counterparties:merchants:$merchant_id:payable, USD/2)
}

send $amount (
  source = @counterparties:merchants:$merchant_id:payable
  destination = @platform:banks:$bank_id:operating
)

set_tx_meta("event_type", "merchant_weekly_settlement")
set_tx_meta("settlement_id", $settlement_id)
set_tx_meta("merchant_id", $merchant_id)
```

### `MERCHANT_SETTLEMENT_RETURN`

Reverse a returned merchant ACH payout; restore the merchant payable and reverse the operating-bank movement.

interpreter: `experimental`

```numscript
vars {
  account $merchant_id
  account $bank_id
  string $settlement_id
  monetary $amount
  string $original_posting_id
}

send $amount (
  source = @platform:banks:$bank_id:operating allowing unbounded overdraft
  destination = @counterparties:merchants:$merchant_id:payable
)

set_tx_meta("event_type", "merchant_settlement_return")
set_tx_meta("settlement_id", $settlement_id)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $original_posting_id)
```

### `PLAN_WRITE_OFF`

Charge off a 90-DPD installment: reclassify outstanding principal to written-off; cancel never-collected interest and fee receivables against their memos with no P&L impact.

interpreter: `experimental`

```numscript
vars {
  account $borrower_id
  string $plan_id
  string $seq
  monetary $principal_outstanding = overdraft(@borrowers:$borrower_id:plans:$plan_id:installments:$seq:principal:outstanding, USD/2)
  monetary $interest_outstanding = overdraft(@borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:accrued, USD/2)
  monetary $fees_outstanding = overdraft(@borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:accrued, USD/2)
}

send $principal_outstanding (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:principal:writtenOff allowing unbounded overdraft
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:principal:outstanding
)

send $interest_outstanding (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:earnedNotCollected
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:interest:accrued
)

send $fees_outstanding (
  source = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:earnedNotCollected
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:fees:accrued
)

set_tx_meta("event_type", "plan_write_off")
set_tx_meta("plan_id", $plan_id)
set_tx_meta("installment_seq", $seq)
```

### `RECOVERY`

Record a partial recovery on a written-off installment; recovery cash via PSP float reduces the charged-off balance toward zero.

interpreter: `experimental`

```numscript
vars {
  account $borrower_id
  string $plan_id
  string $seq
  account $psp_id
  monetary $amount
}

send $amount (
  source = @counterparties:psp:$psp_id:collections:pending allowing unbounded overdraft
  destination = @borrowers:$borrower_id:plans:$plan_id:installments:$seq:principal:writtenOff
)

set_tx_meta("event_type", "recovery")
set_tx_meta("plan_id", $plan_id)
set_tx_meta("installment_seq", $seq)
```

## Queries

### `outstanding_principal_for_one_plan`

**outstanding_principal_for_one_plan**

Returns every installment's principal-outstanding balance for one plan; the operator reads the magnitudes to see what principal is still owed. Run on demand during servicing.

resource: `accounts` · vars: `borrowerId`, `planId`

```json
{
  "$match": {
    "address": "borrowers:${borrowerId}:plans:${planId}:installments::principal:outstanding"
  }
}
```

### `full_schedule_for_one_plan`

**full_schedule_for_one_plan**

Returns every installment-component account for one plan (principal, interest, fees across all states), the complete amortization and repayment picture in one read.

resource: `accounts` · vars: `borrowerId`, `planId`

```json
{
  "$match": {
    "address": "borrowers:${borrowerId}:plans:${planId}:"
  }
}
```

### `everything_for_one_shopper`

**everything_for_one_shopper**

Returns every account and balance for one shopper across all of their plans and installments.

resource: `accounts` · vars: `borrowerId`

```json
{
  "$match": {
    "address": "borrowers:${borrowerId}:"
  }
}
```

### `total_outstanding_principal`

**total_outstanding_principal**

Sums principal-outstanding across every installment of every plan of every borrower; the absolute value is the live principal receivable across the book.

resource: `accounts`

```json
{
  "$match": {
    "address": "borrowers::plans::installments::principal:outstanding"
  }
}
```

### `interest_accrued_not_yet_collected`

**interest_accrued_not_yet_collected**

Sums the interest earned-not-collected memo across the whole book. Under the earned-on-collection model this is interest the platform has accrued but must not recognize as revenue until it is collected.

resource: `accounts`

```json
{
  "$match": {
    "address": "borrowers::plans::installments::interest:earnedNotCollected"
  }
}
```

### `late_fees_accrued_not_yet_collected`

**late_fees_accrued_not_yet_collected**

Sums the late-fee earned-not-collected memo across the whole book: late fees accrued but not yet recognized as revenue.

resource: `accounts`

```json
{
  "$match": {
    "address": "borrowers::plans::installments::fees:earnedNotCollected"
  }
}
```

### `charged_off_principal_for_one_plan`

**charged_off_principal_for_one_plan**

Returns the charged-off principal for one plan; the magnitude is the loss on that plan, already net of any recovery posted back against it.

resource: `accounts` · vars: `borrowerId`, `planId`

```json
{
  "$match": {
    "address": "borrowers:${borrowerId}:plans:${planId}:installments::principal:writtenOff"
  }
}
```

### `total_charged_off_principal_net_of_recoveries`

**total_charged_off_principal_net_of_recoveries**

Sums charged-off principal across the whole book. Because recoveries post back into principal:writtenOff, the magnitude of this sum is the cumulative loss net of recoveries, the single platform loan-loss figure.

resource: `accounts`

```json
{
  "$match": {
    "address": "borrowers::plans::installments::principal:writtenOff"
  }
}
```

### `merchant_payable_for_one_merchant`

**merchant_payable_for_one_merchant**

Returns what the platform currently owes one merchant; this is the amount the next weekly ACH settlement will drain to zero.

resource: `accounts` · vars: `merchantId`

```json
{
  "$match": {
    "address": "counterparties:merchants:${merchantId}:payable"
  }
}
```

### `psp_collection_float`

**psp_collection_float**

Returns the PSP collection float; its magnitude is the cash the PSP has collected from shoppers and not yet remitted to the operating bank.

resource: `accounts` · vars: `pspId`

```json
{
  "$match": {
    "address": "counterparties:psp:${pspId}:collections:pending"
  }
}
```

### `operating_bank_cash_position`

**operating_bank_cash_position**

Returns the operating-bank backing balance; its magnitude is the cash the platform holds at the partner bank.

resource: `accounts` · vars: `bankId`

```json
{
  "$match": {
    "address": "platform:banks:${bankId}:operating"
  }
}
```

### `total_merchant_payable`

**total_merchant_payable**

Sums what the platform owes across every merchant; the total liability the weekly settlement run discharges.

resource: `accounts`

```json
{
  "$match": {
    "address": "counterparties:merchants::payable"
  }
}
```

### `recognized_interest_revenue`

**recognized_interest_revenue**

Returns recognized interest revenue. Under the earned-on-collection model this equals interest actually collected and never includes accrued-but-uncollected interest, which satisfies the rule that uncollected interest is not revenue.

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:revenue:interest"
  }
}
```

### `recognized_late_fee_revenue`

**recognized_late_fee_revenue**

Returns recognized late-fee revenue, equal to late fees actually collected.

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:revenue:fees:late"
  }
}
```

### `revenue_by_stream`

**revenue_by_stream**

Returns every platform revenue account broken out by stream (interest, late fees, merchant discount), the recognized-revenue summary.

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:revenue:"
  }
}
```

### `open_installment_receivables`

**open_installment_receivables**

Returns every installment principal-outstanding account that still carries a balance, the set of installments not yet fully collected. Aging is read from the transaction timestamps that last touched each account.

resource: `accounts`

```json
{
  "$and": [
    {
      "$match": {
        "address": "borrowers::plans::installments::principal:outstanding"
      }
    },
    {
      "$not": {
        "$match": {
          "balance": 0
        }
      }
    }
  ]
}
```

### `charged_off_balances_outstanding`

**charged_off_balances_outstanding**

Returns charged-off installments that still carry a balance (not fully recovered), the collections follow-up worklist.

resource: `accounts`

```json
{
  "$and": [
    {
      "$match": {
        "address": "borrowers::plans::installments::principal:writtenOff"
      }
    },
    {
      "$not": {
        "$match": {
          "balance": 0
        }
      }
    }
  ]
}
```

### `psp_collections_received_today`

**psp_collections_received_today**

Volume into the PSP collection float over the day: the card collections the PSP recorded for the platform, matched against the PSP's daily collection report. Endpoint params: startTime=2026-06-22T00:00:00Z&endTime=2026-06-23T00:00:00Z.

resource: `volumes` · vars: `pspId`

```json
{
  "$match": {
    "address": "counterparties:psp:${pspId}:collections:pending"
  }
}
```

### `merchant_settlement_outflow_today`

**merchant_settlement_outflow_today**

Volume out of the merchant payable across all merchants over the day: the total settled to merchants, matched against the day's ACH file. Endpoint params: startTime=2026-06-22T00:00:00Z&endTime=2026-06-23T00:00:00Z.

resource: `volumes`

```json
{
  "$match": {
    "address": "counterparties:merchants::payable"
  }
}
```
