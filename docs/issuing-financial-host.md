<!-- Generated from schemas/issuing-financial-host.yaml by tools/render-md.ts. Do not edit. -->
# Issuing / Financial Host

> Card issuing as a financial host: auth, settlement, and scheme position.

`issuing` · `cards` · `baas`

**10 accounts · 14 transactions · 11 queries**

## Chart of accounts

- `cardholder`
  - `$account_id`
    - `.pattern`
    - `main`
      - `.self` _(bookable account)_
      - `.metadata`
    - `hold`
      - `$authorization_id`
        - `.self` _(bookable account)_
        - `.metadata`
    - `refund`
      - `pending`
        - `$refund_auth_id`
          - `.self` _(bookable account)_
          - `.metadata`
- `banks`
  - `$bank_id`
    - `.pattern`
    - `main`
      - `.self` _(bookable account)_
      - `.metadata`
- `schemes`
  - `$scheme_id`
    - `.pattern`
    - `main`
      - `.self` _(bookable account)_
      - `.metadata`
    - `chargeback`
      - `.self` _(bookable account)_
      - `.metadata`
- `platform`
  - `$platform_name`
    - `fees`
      - `.self` _(bookable account)_
    - `revenue`
      - `.self` _(bookable account)_
    - `chargeback_fees`
      - `.self` _(bookable account)_
- `program_manager`
  - `$pm_id`
    - `.pattern`
    - `liability`
      - `.self` _(bookable account)_
      - `.metadata`

## Transactions

### `CARD_AUTHORIZATION_APPROVED`

Authorize a card transaction by moving funds from the cardholder's main account to a hold account. Supports optional overdraft.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  number $overdraft
  account $account_id
  string $authorization_id
  string $pii_id
  string $trx_details
}

send [$asset $amount] (
  source = @cardholder:$account_id:main allowing overdraft up to [$asset $overdraft]
  destination = @cardholder:$account_id:hold:$authorization_id
)

set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
```

### `CARD_AUTHORIZATION_PARTIAL`

Authorize a card transaction for up to the requested amount, approving only what is available (including overdraft). Used for partial approvals at fuel dispensers, etc.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  number $overdraft
  account $account_id
  string $authorization_id
  string $pii_id
  string $trx_details
}

send [$asset *] (
  source = max [$asset $amount] from @cardholder:$account_id:main allowing overdraft up to [$asset $overdraft]
  destination = @cardholder:$account_id:hold:$authorization_id
)

set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
```

### `CARD_AUTHORIZATION_INCREMENTAL`

Increase an existing authorization hold by moving additional funds to the same hold account. Used for hotels, car rentals, etc.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  number $overdraft
  account $account_id
  string $authorization_id
  string $pii_id
  string $trx_details
}

send [$asset $amount] (
  source = @cardholder:$account_id:main allowing overdraft up to [$asset $overdraft]
  destination = @cardholder:$account_id:hold:$authorization_id
)

set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("authorization_type", "incremental")
```

### `AUTHORIZATION_REVERSAL`

Release a specific amount from an authorization hold back to the cardholder's main account. Supports both full and partial reversals.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $account_id
  string $authorization_id
  string $reversal_id
  string $pii_id
  string $trx_details
}

send [$asset $amount] (
  source = @cardholder:$account_id:hold:$authorization_id
  destination = @cardholder:$account_id:main
)

set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("reversal_id", $reversal_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "authorization_reversal")
```

### `PRESENTMENT`

Settle an authorized transaction by moving held funds from the hold account to the scheme's liability account.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $account_id
  string $authorization_id
  string $presentment_id
  account $scheme_id
  string $pii_id
  string $trx_details
}

send [$asset $amount] (
  source = @cardholder:$account_id:hold:$authorization_id
  destination = @schemes:$scheme_id:main
)

set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("presentment_id", $presentment_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "presentment")
```

### `PRESENTMENT_WITH_TIP`

Settle a transaction where the presentment exceeds the authorization (e.g., restaurant tip). Debits the hold for the authorized amount and the main account for the additional amount.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $auth_amount
  number $additional_amount
  account $account_id
  string $authorization_id
  string $presentment_id
  account $scheme_id
  string $pii_id
  string $trx_details
}

// Move the authorized amount from hold to scheme
send [$asset $auth_amount] (
  source = @cardholder:$account_id:hold:$authorization_id
  destination = @schemes:$scheme_id:main
)

// Debit the additional amount (tip) directly from main account
send [$asset $additional_amount] (
  source = @cardholder:$account_id:main
  destination = @schemes:$scheme_id:main
)

set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("presentment_id", $presentment_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "presentment_with_tip")
```

### `OFFLINE_PRESENTMENT`

Process an offline transaction where no prior authorization exists. Debits the cardholder's main account directly with unbounded overdraft, since the chip already approved the transaction.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $account_id
  string $presentment_id
  account $scheme_id
  string $pii_id
  string $trx_details
}

// Mandatory debit from main account - no prior authorization exists
send [$asset $amount] (
  source = @cardholder:$account_id:main allowing unbounded overdraft
  destination = @schemes:$scheme_id:main
)

set_tx_meta("presentment_id", $presentment_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "offline_presentment")
set_tx_meta("authorization_mode", "offline")
```

### `REFUND_AUTHORIZATION`

Authorize a refund from a merchant. Funds move from the scheme to a pending refund account, not yet available to the cardholder.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $account_id
  string $refund_auth_id
  account $scheme_id
  string $pii_id
  string $trx_details
}

// Move from scheme to pending refund account (not yet available to cardholder)
send [$asset $amount] (
  source = @schemes:$scheme_id:main allowing unbounded overdraft
  destination = @cardholder:$account_id:refund:pending:$refund_auth_id
)

set_tx_meta("refund_auth_id", $refund_auth_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "refund_authorization")
set_tx_meta("refund_status", "pending")
```

### `REFUND_POSTING`

Complete a refund by releasing pending funds to the cardholder's main account, making them available for use.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $account_id
  string $refund_auth_id
  string $refund_posting_id
  string $trx_details
}

// Release funds from pending to main account (now available to cardholder)
send [$asset $amount] (
  source = @cardholder:$account_id:refund:pending:$refund_auth_id
  destination = @cardholder:$account_id:main
)

set_tx_meta("refund_auth_id", $refund_auth_id)
set_tx_meta("refund_posting_id", $refund_posting_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "refund_posting")
set_tx_meta("refund_status", "completed")
```

### `HOLD_REVERSAL_WILDCARD`

Release all remaining funds from a hold account back to the cardholder. Uses wildcard amount to automatically release whatever balance remains. Used after partial presentments, expired authorizations, or cancellations.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  account $account_id
  string $authorization_id
  string $reversal_id
  string $pii_id
  string $trx_details
}

// Release all remaining funds from hold account back to main account
send [$asset *] (
  source = @cardholder:$account_id:hold:$authorization_id
  destination = @cardholder:$account_id:main
)

set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("reversal_id", $reversal_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "hold_reversal")
```

### `CHARGEBACK_ACCEPTANCE`

Accept a chargeback by crediting the cardholder from the scheme's dedicated chargeback account.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $account_id
  string $chargeback_id
  account $scheme_id
  string $original_presentment_id
  string $pii_id
  string $trx_details
}

// Credit cardholder from scheme's chargeback account
send [$asset $amount] (
  source = @schemes:$scheme_id:chargeback allowing unbounded overdraft
  destination = @cardholder:$account_id:main
)

set_tx_meta("chargeback_id", $chargeback_id)
set_tx_meta("original_presentment_id", $original_presentment_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "chargeback_acceptance")
set_tx_meta("chargeback_status", "accepted")
```

### `CHARGEBACK_CONFIRMATION`

Confirm a chargeback by moving funds from the scheme's main settlement account to cover the chargeback account. Aligns with scheme settlement deductions.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  string $chargeback_id
  account $scheme_id
  string $settlement_ref
  string $trx_details
}

// Cover the chargeback account from scheme's main settlement account
send [$asset $amount] (
  source = @schemes:$scheme_id:main allowing unbounded overdraft
  destination = @schemes:$scheme_id:chargeback
)

set_tx_meta("chargeback_id", $chargeback_id)
set_tx_meta("settlement_ref", $settlement_ref)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "chargeback_confirmation")
set_tx_meta("chargeback_status", "confirmed")
```

### `SECOND_PRESENTMENT`

Reverse a chargeback when the merchant wins a dispute. Debits the cardholder and re-establishes the scheme liability.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $account_id
  string $chargeback_id
  string $second_presentment_id
  account $scheme_id
  string $pii_id
  string $trx_details
}

// Debit cardholder (reverses the chargeback credit) and credit scheme liability
send [$asset $amount] (
  source = @cardholder:$account_id:main allowing unbounded overdraft
  destination = @schemes:$scheme_id:main
)

set_tx_meta("chargeback_id", $chargeback_id)
set_tx_meta("second_presentment_id", $second_presentment_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "second_presentment")
set_tx_meta("chargeback_status", "reversed")
```

### `STIP_ADVICE`

Process a Stand-In Processing advice for a transaction approved by the processor when the issuer was unavailable. Mandatory debit with unbounded overdraft.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $account_id
  string $stip_advice_id
  account $scheme_id
  string $pii_id
  string $trx_details
}

// Mandatory debit from main account - transaction was already approved by stand-in processor
send [$asset $amount] (
  source = @cardholder:$account_id:main allowing unbounded overdraft
  destination = @schemes:$scheme_id:main
)

set_tx_meta("stip_advice_id", $stip_advice_id)
set_tx_meta("pii_id", $pii_id)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "stip_advice")
set_tx_meta("authorization_mode", "stand_in")
```

## Queries

### `ALL_HOLDS`

All authorization hold accounts across all cardholders

resource: `volumes`

```json
{
  "$match": {
    "address": "cardholder::hold:"
  }
}
```

### `CARDHOLDER_HOLDS`

All authorization holds for a specific cardholder

resource: `volumes` · vars: `account_id`

```json
{
  "$match": {
    "address": "cardholder:${account_id}:hold:"
  }
}
```

### `SPECIFIC_HOLD`

A single authorization hold amount

resource: `accounts` · vars: `account_id`, `authorization_id`

```json
{
  "$match": {
    "address": "cardholder:${account_id}:hold:${authorization_id}"
  }
}
```

### `PENDING_REFUNDS`

All authorized but unposted refunds

resource: `volumes`

```json
{
  "$match": {
    "address": "cardholder::refund:pending:"
  }
}
```

### `SCHEME_LIABILITY`

Total liability owed to a specific scheme

resource: `accounts` · vars: `scheme_id`

```json
{
  "$match": {
    "address": "schemes:${scheme_id}:main"
  }
}
```

### `ALL_SCHEME_LIABILITIES`

All scheme accounts and their balances

resource: `volumes`

```json
{
  "$match": {
    "address": "schemes:"
  }
}
```

### `ALL_CARDHOLDER_BALANCES`

All cardholder main account balances

resource: `volumes`

```json
{
  "$match": {
    "address": "cardholder::main"
  }
}
```

### `SCHEME_CHARGEBACKS`

Chargeback liabilities for a specific scheme

resource: `accounts` · vars: `scheme_id`

```json
{
  "$match": {
    "address": "schemes:${scheme_id}:chargeback"
  }
}
```

### `ALL_CHARGEBACKS`

All scheme chargeback accounts

resource: `volumes`

```json
{
  "$match": {
    "address": "schemes::chargeback"
  }
}
```

### `ACTIVE_HOLDS_FOR_CARD`

Active authorization holds for a specific payment instrument with balance

resource: `volumes` · vars: `pii_id`

```json
{
  "$and": [
    {
      "$match": {
        "address": "cardholder::hold:"
      }
    },
    {
      "$match": {
        "metadata[pii_id]": "${pii_id}"
      }
    },
    {
      "$gt": {
        "balance[EUR/2]": "0"
      }
    }
  ]
}
```

### `OFFLINE_TRANSACTIONS`

All offline transaction presentments

resource: `transactions`

```json
{
  "$and": [
    {
      "$match": {
        "account": "cardholder:"
      }
    },
    {
      "$match": {
        "metadata[transaction_type]": "offline_presentment"
      }
    }
  ]
}
```
