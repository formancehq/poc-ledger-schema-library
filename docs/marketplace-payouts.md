<!-- Generated from schemas/marketplace-payouts.yaml by tools/render-md.ts. Do not edit. -->
# Marketplace Payouts

> Order split, seller balances, chargeback absorption.

`marketplace` · `payouts` · `chargebacks`

**14 accounts · 10 transactions · 17 queries**

## Chart of accounts

- `sellers`
  - `$seller_id`
    - `payable`
    - `payout`
      - `pending`
    - `.self` _(bookable account)_
- `escrow`
  - `orders`
    - `$order_id`
      - `held`
- `platform`
  - `revenue`
    - `commission`
    - `fx`
    - `.self` _(bookable account)_
  - `expense`
    - `refunds`
    - `chargebacks`
    - `.self` _(bookable account)_
  - `banks`
    - `$bank_id`
      - `operating`
      - `payout`
  - `treasury`
    - `fx`
  - `suspense`
    - `reconciliation`
      - `differences`
- `counterparties`
  - `psp`
    - `$psp_id`
      - `settlement`
      - `feesPayable`
      - `.self` _(bookable account)_
- `exchanges`
  - `conv`
    - `$conversion_id`

## Transactions

### `ORDER_PAYMENT_CAPTURED`

Buyer card payment captured at the PSP; gross splits into commission, PSP fee, and held seller share

interpreter: `experimental`

```numscript
vars {
  account $psp_id
  account $order_id
  account $seller_id
  monetary $gross
  monetary $commission
  monetary $psp_fee
  string $order_ref
}

send $gross (
  source = @counterparties:psp:$psp_id:settlement allowing unbounded overdraft
  destination = {
    max $commission to @platform:revenue:commission
    max $psp_fee to @counterparties:psp:$psp_id:feesPayable
    remaining to @escrow:orders:$order_id:held
  }
)

set_tx_meta("event_type", "order_payment_captured")
set_tx_meta("order_id", $order_ref)
set_tx_meta("seller_id", $seller_id)
```

### `PSP_SETTLEMENT`

Daily PSP cash sweep to the platform bank; PSP retains its fees

interpreter: `experimental`

```numscript
vars {
  account $psp_id
  account $bank_id
  monetary $gross_settled
  monetary $fees_retained
  string $settlement_ref
}

send $gross_settled (
  source = @platform:banks:$bank_id:operating allowing unbounded overdraft
  destination = @counterparties:psp:$psp_id:settlement
)

send $fees_retained (
  source = @counterparties:psp:$psp_id:feesPayable
  destination = @platform:banks:$bank_id:operating
)

set_tx_meta("event_type", "psp_settlement")
set_tx_meta("settlement_ref", $settlement_ref)
```

### `SELLER_FUNDS_RELEASE`

Delivery confirmed; held order funds released to the seller payable

interpreter: `experimental`

```numscript
vars {
  account $order_id
  account $seller_id
  string $order_ref
}

send [USD/2 *] (
  source = @escrow:orders:$order_id:held
  destination = @sellers:$seller_id:payable
)

set_tx_meta("event_type", "seller_funds_release")
set_tx_meta("order_id", $order_ref)
```

### `SELLER_PAYOUT_INITIATE`

Weekly payout run reserves the seller's payable into an in-flight payout

interpreter: `experimental`

```numscript
vars {
  account $seller_id
  monetary $amount
  string $payout_ref
}

send $amount (
  source = @sellers:$seller_id:payable
  destination = @sellers:$seller_id:payout:pending
)

set_tx_meta("event_type", "seller_payout_initiate")
set_tx_meta("payout_ref", $payout_ref)
```

### `SELLER_PAYOUT_SETTLE`

Weekly payout bank transfer confirmed; in-flight payout discharged

interpreter: `experimental`

```numscript
vars {
  account $seller_id
  account $bank_id
  monetary $amount
  string $payout_ref
}

send $amount (
  source = @sellers:$seller_id:payout:pending
  destination = @platform:banks:$bank_id:payout
)

set_tx_meta("event_type", "seller_payout_settle")
set_tx_meta("payout_ref", $payout_ref)
```

### `SELLER_PAYOUT_RETURN`

Reserved payout failed; in-flight amount returned to the seller payable

interpreter: `experimental`

```numscript
vars {
  account $seller_id
  monetary $amount
  string $payout_ref
}

send $amount (
  source = @sellers:$seller_id:payout:pending
  destination = @sellers:$seller_id:payable
)

set_tx_meta("event_type", "seller_payout_return")
set_tx_meta("adjustment_flag", "true")
set_tx_meta("payout_ref", $payout_ref)
```

### `REFUND`

Refund a past order to the buyer; clawed back from seller, commission, and platform-absorbed PSP fee

interpreter: `experimental`

```numscript
vars {
  account $psp_id
  account $seller_id
  monetary $gross
  monetary $seller_net
  monetary $commission
  string $order_ref
  string $original_posting_id
}

send $gross (
  source = {
    max $seller_net from @sellers:$seller_id:payable allowing unbounded overdraft
    max $commission from @platform:revenue:commission allowing unbounded overdraft
    @platform:expense:refunds allowing unbounded overdraft
  }
  destination = @counterparties:psp:$psp_id:settlement
)

set_tx_meta("event_type", "refund")
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $original_posting_id)
set_tx_meta("order_id", $order_ref)
```

### `CHARGEBACK`

Buyer chargeback; charged against the seller balance with the platform absorbing any shortfall

interpreter: `experimental`

```numscript
vars {
  account $psp_id
  account $seller_id
  monetary $gross
  string $order_ref
  string $dispute_ref
}

send $gross (
  source = {
    max $gross from @sellers:$seller_id:payable
    @platform:expense:chargebacks allowing unbounded overdraft
  }
  destination = @counterparties:psp:$psp_id:settlement
)

set_tx_meta("event_type", "chargeback")
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $dispute_ref)
set_tx_meta("order_id", $order_ref)
```

### `MULTI_CURRENCY_PAYOUT`

Cross the seller payable to the payout currency at the treasury rate, into the in-flight payout

interpreter: `experimental`

```numscript
vars {
  account $seller_id
  account $conversion_id
  monetary $sell_amount
  monetary $buy_gross
  monetary $spread
  string $execution_rate
  string $payout_ref
}

send $sell_amount (
  source = @sellers:$seller_id:payable
  destination = @exchanges:conv:$conversion_id
)

send $sell_amount (
  source = @exchanges:conv:$conversion_id
  destination = @platform:treasury:fx
)

send $buy_gross (
  source = @platform:treasury:fx allowing unbounded overdraft
  destination = @exchanges:conv:$conversion_id
)

send $buy_gross (
  source = @exchanges:conv:$conversion_id
  destination = {
    max $spread to @platform:revenue:fx
    remaining to @sellers:$seller_id:payout:pending
  }
)

set_account_meta(@exchanges:conv:$conversion_id, "execution_rate", $execution_rate)
set_account_meta(@exchanges:conv:$conversion_id, "status", "settled")
set_tx_meta("event_type", "multi_currency_payout")
set_tx_meta("payout_ref", $payout_ref)
```

### `RECON_ADJUSTMENT`

Book a ledger-vs-statement reconciliation difference into suspense pending investigation

interpreter: `experimental`

```numscript
vars {
  account $psp_id
  monetary $amount
  string $recon_ref
}

send $amount (
  source = @counterparties:psp:$psp_id:settlement allowing unbounded overdraft
  destination = @platform:suspense:reconciliation:differences
)

set_tx_meta("event_type", "recon_adjustment")
set_tx_meta("recon_ref", $recon_ref)
```

## Queries

### `one_seller_s_outstanding_position`

**one_seller_s_outstanding_position**

Every account and balance under one seller: released payable plus any in-flight payout. Returns one row per (account, asset).

resource: `accounts` · vars: `SELLER_ID`

```json
{
  "$match": {
    "address": "sellers:${SELLER_ID}:"
  }
}
```

### `held_versus_available_for_one_seller`

**held_versus_available_for_one_seller**

The seller's available payable balance only (excludes held escrow, which is keyed by order, not seller).

resource: `accounts` · vars: `SELLER_ID`

```json
{
  "$match": {
    "address": "sellers:${SELLER_ID}:payable"
  }
}
```

### `sellers_with_a_negative_balance`

**sellers_with_a_negative_balance**

Seller payables that have gone negative, which happens when a refund landed after the seller was already paid out. These are the amounts the platform must recover.

resource: `accounts`

```json
{
  "$and": [
    {
      "$match": {
        "address": "sellers::payable"
      }
    },
    {
      "$lt": {
        "balance[USD/2]": 0
      }
    }
  ]
}
```

### `total_seller_liability`

**total_seller_liability**

Sum of every seller's released payable across all sellers, per asset (aggregate-balances endpoint maps to accounts resource).

resource: `accounts`

```json
{
  "$match": {
    "address": "sellers::payable"
  }
}
```

### `total_held_in_delivery_confirmation`

**total_held_in_delivery_confirmation**

Sum of all per-order held escrow balances across the marketplace, per asset (aggregate-balances endpoint maps to accounts resource).

resource: `accounts`

```json
{
  "$match": {
    "address": "escrow:orders::held"
  }
}
```

### `platform_revenue_by_stream`

**platform_revenue_by_stream**

Every platform revenue stream broken out (commission and FX spread), per asset (aggregate-balances endpoint maps to accounts resource).

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:revenue:"
  }
}
```

### `treasury_fx_position`

**treasury_fx_position**

The platform's open FX book position from currency crossings, per asset (aggregate-balances endpoint maps to accounts resource).

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:treasury:fx"
  }
}
```

### `platform_absorbed_refund_and_chargeback_cost`

**platform_absorbed_refund_and_chargeback_cost**

The platform's expense accounts for absorbed PSP fees on refunds and for chargeback shortfalls, per asset (aggregate-balances endpoint maps to accounts resource).

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:expense:"
  }
}
```

### `per_order_fee_and_commission_split`

**per_order_fee_and_commission_split**

How much flowed into commission, the PSP fee payable, and the held escrow for one order, read as volume into each leg over the order's window.

resource: `volumes` · vars: `PSP_ID`, `ORDER_ID`

```json
{
  "$or": [
    {
      "$match": {
        "address": "platform:revenue:commission"
      }
    },
    {
      "$match": {
        "address": "counterparties:psp:${PSP_ID}:feesPayable"
      }
    },
    {
      "$match": {
        "address": "escrow:orders:${ORDER_ID}:held"
      }
    }
  ]
}
```

### `revenue_earned_over_a_period`

**revenue_earned_over_a_period**

Volume into the platform revenue accounts over a reporting window: commission plus FX spread recognized in the period.

resource: `volumes`

```json
{
  "$match": {
    "address": "platform:revenue:"
  }
}
```

### `payout_throughput_for_one_seller`

**payout_throughput_for_one_seller**

How much money moved out to one seller over a period, read as volume out of the seller's in-flight payout into the payout bank.

resource: `volumes` · vars: `SELLER_ID`

```json
{
  "$match": {
    "address": "sellers:${SELLER_ID}:payout:pending"
  }
}
```

### `psp_net_position`

**psp_net_position**

The platform's full net position with one PSP: the settlement receivable (running negative) and the fees payable (running positive).

resource: `accounts` · vars: `PSP_ID`

```json
{
  "$match": {
    "address": "counterparties:psp:${PSP_ID}:"
  }
}
```

### `psp_settlement_reconciliation`

**psp_settlement_reconciliation**

The ledger side of the daily PSP reconciliation: the settlement receivable for one PSP, compared against the PSP settlement report's reported held balance.

resource: `accounts` · vars: `PSP_ID`

```json
{
  "$match": {
    "address": "counterparties:psp:${PSP_ID}:settlement"
  }
}
```

### `payout_bank_file_reconciliation`

**payout_bank_file_reconciliation**

The ledger side of the weekly payout reconciliation: volume into the payout bank account over the payout window, compared against the total of the payout bank file.

resource: `volumes`

```json
{
  "$match": {
    "address": "platform:banks::payout"
  }
}
```

### `aging_escrow_holds`

**aging_escrow_holds**

Per-order escrow holds with a non-zero balance: an escrow drains to zero when its order is released or refunded, so a lingering non-zero balance past the expected hold window is the aging signal.

resource: `accounts`

```json
{
  "$and": [
    {
      "$match": {
        "address": "escrow:orders::held"
      }
    },
    {
      "$not": {
        "$match": {
          "balance[USD/2]": 0
        }
      }
    }
  ]
}
```

### `unresolved_reconciliation_differences`

**unresolved_reconciliation_differences**

The suspense differences account: non-zero means reconciliation deltas booked but not yet resolved.

resource: `accounts`

```json
{
  "$and": [
    {
      "$match": {
        "address": "platform:suspense:reconciliation:differences"
      }
    },
    {
      "$not": {
        "$match": {
          "balance[USD/2]": 0
        }
      }
    }
  ]
}
```

### `audit_trail_for_one_order`

**audit_trail_for_one_order**

Every transaction tagged with one order id, in any direction: capture, release, refund, chargeback.

resource: `transactions` · vars: `ORDER_ID`

```json
{
  "$match": {
    "metadata[order_id]": "${ORDER_ID}"
  }
}
```
