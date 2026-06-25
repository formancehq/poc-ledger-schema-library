<!-- Generated from schemas/neobank-fbo.yaml by tools/render-md.ts. Do not edit. -->
# Neobank (FBO)

> Omnibus account, per-customer balances, daily FBO recon.

`neobank` · `fbo` · `reconciliation`

**10 accounts · 18 transactions · 17 queries**

## Chart of accounts

- `customers`
  - `$customerId`
    - `.pattern`
    - `available`
    - `holds`
      - `$authId`
        - `.pattern`
    - `withdrawals`
      - `$withdrawalId`
        - `.pattern`
        - `pending`
    - `advances`
      - `$advanceId`
        - `.pattern`
        - `outstanding`
    - `.self` _(bookable account)_
- `platform`
  - `banks`
    - `sponsor`
      - `fbo`
        - `settled`
        - `buffer`
    - `corporate`
      - `settled`
      - `operating`
  - `revenue`
    - `interest`
  - `expense`
    - `advanceLoss`

## Transactions

### `ACH_DIRECT_DEPOSIT`

Inbound ACH direct deposit settled into the FBO and credited to the customer

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  monetary $amount
  string $deposit_id
  string $originator
}

send $amount (
  source = @platform:banks:sponsor:fbo:settled allowing unbounded overdraft
  destination = @customers:$customer_id:available
)

set_tx_meta("event_type", "ach_direct_deposit")
set_tx_meta("deposit_id", $deposit_id)
set_tx_meta("originator", $originator)
```

### `INCOMING_WIRE`

Inbound wire settled into the FBO and credited to the customer

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  monetary $amount
  string $wire_id
  string $originator
}

send $amount (
  source = @platform:banks:sponsor:fbo:settled allowing unbounded overdraft
  destination = @customers:$customer_id:available
)

set_tx_meta("event_type", "incoming_wire")
set_tx_meta("wire_id", $wire_id)
set_tx_meta("originator", $originator)
```

### `ACH_DEPOSIT_RETURN`

Reversal of a settled ACH deposit returned by the originating bank

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  monetary $amount
  string $deposit_id
}

send $amount (
  source = @customers:$customer_id:available allowing unbounded overdraft
  destination = @platform:banks:sponsor:fbo:settled
)

set_tx_meta("event_type", "ach_deposit_return")
set_tx_meta("deposit_id", $deposit_id)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $deposit_id)
```

### `CARD_AUTH`

Debit-card authorization places a hold on the customer's available balance

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  string $auth_id
  monetary $amount
}

send $amount (
  source = @customers:$customer_id:available
  destination = @customers:$customer_id:holds:$auth_id
)

set_tx_meta("event_type", "card_auth")
set_tx_meta("auth_id", $auth_id)
```

### `CARD_AUTH_REVERSE`

Merchant-initiated reversal of a card authorization; hold returns to available

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  string $auth_id
  monetary $amount
}

send $amount (
  source = @customers:$customer_id:holds:$auth_id
  destination = @customers:$customer_id:available
)

set_tx_meta("event_type", "card_auth_reverse")
set_tx_meta("auth_id", $auth_id)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $auth_id)
```

### `CARD_AUTH_EXPIRE`

Authorization hold expires unused; remaining hold returns to available

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  string $auth_id
  monetary $hold_balance = balance(@customers:$customer_id:holds:$auth_id, USD/2)
}

send $hold_balance (
  source = @customers:$customer_id:holds:$auth_id
  destination = @customers:$customer_id:available
)

set_tx_meta("event_type", "card_auth_expire")
set_tx_meta("auth_id", $auth_id)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $auth_id)
```

### `CARD_CAPTURE`

Capture against an authorization; captured amount leaves the FBO, remainder restored

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  string $auth_id
  monetary $capture_amount
  monetary $hold_balance = balance(@customers:$customer_id:holds:$auth_id, USD/2)
}

send $hold_balance (
  source = @customers:$customer_id:holds:$auth_id
  destination = {
    max $capture_amount to @platform:banks:sponsor:fbo:settled
    remaining to @customers:$customer_id:available
  }
)

set_tx_meta("event_type", "card_capture")
set_tx_meta("auth_id", $auth_id)
```

### `CARD_REFUND`

Merchant refund of a prior capture credited to the customer

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  monetary $amount
  string $refund_id
  string $original_capture_id
}

send $amount (
  source = @platform:banks:sponsor:fbo:settled allowing unbounded overdraft
  destination = @customers:$customer_id:available
)

set_tx_meta("event_type", "card_refund")
set_tx_meta("refund_id", $refund_id)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $original_capture_id)
```

### `P2P_TRANSFER`

Instant in-ledger transfer between two customers; never touches the bank

interpreter: `experimental`

```numscript
vars {
  account $from_customer_id
  account $to_customer_id
  monetary $amount
  string $transfer_id
}

send $amount (
  source = @customers:$from_customer_id:available
  destination = @customers:$to_customer_id:available
)

set_tx_meta("event_type", "p2p_transfer")
set_tx_meta("transfer_id", $transfer_id)
```

### `ACH_WITHDRAWAL_RESERVE`

Customer-requested outbound ACH withdrawal earmarked from available to pending

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  string $withdrawal_id
  monetary $amount
}

send $amount (
  source = @customers:$customer_id:available
  destination = @customers:$customer_id:withdrawals:$withdrawal_id:pending
)

set_tx_meta("event_type", "ach_withdrawal_reserve")
set_tx_meta("withdrawal_id", $withdrawal_id)
```

### `ACH_WITHDRAWAL_SETTLE`

Outbound ACH settles; pending funds leave the FBO

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  string $withdrawal_id
  monetary $amount
}

send $amount (
  source = @customers:$customer_id:withdrawals:$withdrawal_id:pending
  destination = @platform:banks:sponsor:fbo:settled
)

set_tx_meta("event_type", "ach_withdrawal_settle")
set_tx_meta("withdrawal_id", $withdrawal_id)
```

### `ACH_WITHDRAWAL_RETURN`

Outbound ACH failed or returned; pending funds restored to available

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  string $withdrawal_id
  monetary $amount
}

send $amount (
  source = @customers:$customer_id:withdrawals:$withdrawal_id:pending
  destination = @customers:$customer_id:available
)

set_tx_meta("event_type", "ach_withdrawal_return")
set_tx_meta("withdrawal_id", $withdrawal_id)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $withdrawal_id)
```

### `ADVANCE_ORIGINATION`

Platform fronts an early-access advance; credited to available, booked as a receivable

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  string $advance_id
  monetary $amount
}

send $amount (
  source = @customers:$customer_id:advances:$advance_id:outstanding allowing unbounded overdraft
  destination = @customers:$customer_id:available
)

set_tx_meta("event_type", "advance_origination")
set_tx_meta("advance_id", $advance_id)
```

### `ADVANCE_SETTLEMENT`

Expected deposit settles; repays the advance first, remainder to available

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  string $advance_id
  monetary $deposit_amount
  monetary $advance_outstanding = overdraft(@customers:$customer_id:advances:$advance_id:outstanding, USD/2)
}

send $deposit_amount (
  source = @platform:banks:sponsor:fbo:settled allowing unbounded overdraft
  destination = {
    max $advance_outstanding to @customers:$customer_id:advances:$advance_id:outstanding
    remaining to @customers:$customer_id:available
  }
)

set_tx_meta("event_type", "advance_settlement")
set_tx_meta("advance_id", $advance_id)
```

### `ADVANCE_WRITEOFF`

Unrecoverable advance written off to loss; platform funds the FBO from corporate

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  string $advance_id
  monetary $advance_outstanding = overdraft(@customers:$customer_id:advances:$advance_id:outstanding, USD/2)
}

send $advance_outstanding (
  source = @platform:expense:advanceLoss allowing unbounded overdraft
  destination = @customers:$customer_id:advances:$advance_id:outstanding
)

send $advance_outstanding (
  source = @platform:banks:sponsor:fbo:settled allowing unbounded overdraft
  destination = @platform:banks:corporate:settled
)

set_tx_meta("event_type", "advance_writeoff")
set_tx_meta("advance_id", $advance_id)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $advance_id)
```

### `FBO_INTEREST_SWEEP`

Monthly sponsor interest on the FBO recognized as platform revenue

interpreter: `machine`

```numscript
vars {
  monetary $amount
  string $period_id
}

send $amount (
  source = @platform:banks:sponsor:fbo:settled allowing unbounded overdraft
  destination = @platform:revenue:interest
)

set_tx_meta("event_type", "fbo_interest_sweep")
set_tx_meta("period_id", $period_id)
```

### `OPERATING_MOVEMENT_TO_CORPORATE`

Weekly sweep of platform float from the FBO buffer to the corporate bank

interpreter: `machine`

```numscript
vars {
  monetary $amount
  string $movement_id
}

send $amount (
  source = @platform:banks:sponsor:fbo:buffer
  destination = @platform:banks:sponsor:fbo:settled
)

send $amount (
  source = @platform:banks:corporate:settled allowing unbounded overdraft
  destination = @platform:banks:corporate:operating
)

set_tx_meta("event_type", "operating_movement_to_corporate")
set_tx_meta("movement_id", $movement_id)
```

### `OPERATING_MOVEMENT_TO_FBO`

Weekly top-up of platform float from the corporate bank into the FBO buffer

interpreter: `machine`

```numscript
vars {
  monetary $amount
  string $movement_id
}

send $amount (
  source = @platform:banks:corporate:operating
  destination = @platform:banks:corporate:settled
)

send $amount (
  source = @platform:banks:sponsor:fbo:settled allowing unbounded overdraft
  destination = @platform:banks:sponsor:fbo:buffer
)

set_tx_meta("event_type", "operating_movement_to_fbo")
set_tx_meta("movement_id", $movement_id)
```

## Queries

### `daily_fbo_reconciliation_invariant_1`

**Daily FBO reconciliation (invariant 1)**

The single asset-side account the platform reconciles against the sponsor's reported FBO statement every day. The FBO settled account runs negative; its absolute value is the ledger's view of settled cash in the pooled account.

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:banks:sponsor:fbo:settled"
  }
}
```

### `total_claims_against_the_fbo_internal_solvency_check`

**Total claims against the FBO (internal solvency check)**

The sum of every positive claim against the FBO settled cash: all customer available, held, and pending-withdrawal balances, the platform's FBO float, and FBO interest revenue. Compared internally against the FBO backing plus outstanding advances (design.md invariant 1).

resource: `accounts`

```json
{
  "$or": [
    {
      "$match": {
        "address": "customers::available"
      }
    },
    {
      "$match": {
        "address": "customers::holds::"
      }
    },
    {
      "$match": {
        "address": "customers::withdrawals::pending"
      }
    },
    {
      "$match": {
        "address": "platform:banks:sponsor:fbo:buffer"
      }
    },
    {
      "$match": {
        "address": "platform:revenue:interest"
      }
    }
  ]
}
```

### `customer_available_balance`

**Customer available balance**

One customer's spendable balance right now. The canonical per-customer balance read.

resource: `accounts` · vars: `customerId`

```json
{
  "$match": {
    "address": "customers:${customerId}:available"
  }
}
```

### `customer_total_holds`

**Customer total holds**

All current authorization holds for one customer, one row per hold. The sum is that customer's on-hold amount; available plus held is the customer's gross balance.

resource: `accounts` · vars: `customerId`

```json
{
  "$match": {
    "address": "customers:${customerId}:holds:"
  }
}
```

### `customer_full_position`

**Customer full position**

Every account in one customer's subtree (available, each hold, each pending withdrawal, each advance) in a single read. Each row is one (account, asset, balance) triple.

resource: `accounts` · vars: `customerId`

```json
{
  "$match": {
    "address": "customers:${customerId}:"
  }
}
```

### `total_customer_spendable_and_held_liability`

**Total customer spendable and held liability**

Total amount the platform owes customers as spendable plus on-hold funds, across every customer. This is the headline platform liability per asset.

resource: `accounts`

```json
{
  "$or": [
    {
      "$match": {
        "address": "customers::available"
      }
    },
    {
      "$match": {
        "address": "customers::holds::"
      }
    }
  ]
}
```

### `total_platform_float`

**Total platform float**

The platform's own money, provably separate from customer funds: the float held inside the FBO plus the operating float at the corporate bank. Neither address sits under the customers root, which is the structural proof of separation.

resource: `accounts`

```json
{
  "$or": [
    {
      "$match": {
        "address": "platform:banks:sponsor:fbo:buffer"
      }
    },
    {
      "$match": {
        "address": "platform:banks:corporate:operating"
      }
    }
  ]
}
```

### `outstanding_advances`

**Outstanding advances**

Every advance account that still carries a balance. Advance accounts run negative while outstanding and drain to zero when the deposit settles, so a non-zero balance is an open advance.

resource: `accounts`

```json
{
  "$and": [
    {
      "$match": {
        "address": "customers::advances::outstanding"
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

### `aging_advances`

**Aging advances**

Advances that still carry a balance after the expected-deposit window. Combined with an insertion_date upper bound on the API path, this surfaces short or unrecovered advances that need clawback or write-off.

resource: `accounts`

```json
{
  "$and": [
    {
      "$match": {
        "address": "customers::advances::outstanding"
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

### `total_advance_exposure`

**Total advance exposure**

The platform's total early-access advance exposure right now: the summed magnitude of every outstanding advance receivable.

resource: `accounts`

```json
{
  "$match": {
    "address": "customers::advances::outstanding"
  }
}
```

### `pending_withdrawals_in_flight`

**Pending withdrawals in flight**

Every per-withdrawal pending account that still carries a balance: outbound ACH funds earmarked but not yet settled or returned. Drains to zero on settle or return, so a non-zero balance is in-flight.

resource: `accounts`

```json
{
  "$and": [
    {
      "$match": {
        "address": "customers::withdrawals::pending"
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

### `card_capture_volume`

**Card capture volume**

Capture cash leaving the FBO over a window. Read volume on the settled account over the window (use startTime/endTime URL parameters).

resource: `volumes`

```json
{
  "$match": {
    "address": "platform:banks:sponsor:fbo:settled"
  }
}
```

### `p2p_transfer_volume`

**P2P transfer volume**

Total peer-to-peer volume moving through customer available balances over a window. Read volume on the customer available subtree (use startTime/endTime URL parameters).

resource: `volumes`

```json
{
  "$match": {
    "address": "customers::available"
  }
}
```

### `monthly_interest_revenue`

**Monthly interest revenue**

FBO interest recognized to platform revenue over the month. Read the volume into the interest revenue account over the window (use startTime/endTime URL parameters).

resource: `volumes`

```json
{
  "$match": {
    "address": "platform:revenue:interest"
  }
}
```

### `advance_loss_to_date`

**Advance loss to date**

Realized loss on unrecovered advances. The advance-loss expense account runs negative; its magnitude is the cumulative loss. Read the current balance for the running total, or volume for a period figure.

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:expense:advanceLoss"
  }
}
```

### `customer_transaction_audit`

**Customer transaction audit**

Every transaction that touched any account in one customer's subtree, in either direction. For drill-down and dispute investigation, not for balance questions.

resource: `transactions` · vars: `customerId`

```json
{
  "$match": {
    "account": "customers:${customerId}:"
  }
}
```

### `authorization_lifecycle_audit`

**Authorization lifecycle audit**

Every transaction for one card authorization (auth, capture, reverse, or expire), identified by the per-hold account.

resource: `transactions` · vars: `customerId`, `authId`

```json
{
  "$match": {
    "account": "customers:${customerId}:holds:${authId}"
  }
}
```
