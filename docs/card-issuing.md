<!-- Generated from schemas/card-issuing.yaml by tools/render-md.ts. Do not edit. -->
# Card Issuing

> Auth-to-settlement lifecycle with a daily three-way match.

`cards` · `issuing` · `settlement`

**12 accounts · 15 transactions · 14 queries**

## Chart of accounts

- `cardholders`
  - `$cardholder_id`
    - `.self` _(bookable account)_
    - `available`
    - `holds`
      - `$authorization_id`
      - `.self` _(bookable account)_
- `platform`
  - `banks`
    - `$bank_id`
      - `custody`
      - `settlement`
  - `clearing`
    - `schemes`
      - `$scheme_id`
        - `captured`
  - `revenue`
    - `interchange`
      - `$program_id`
        - `accrued`
        - `settled`
      - `.self` _(bookable account)_
  - `expense`
    - `binSponsor`
      - `$program_id`
        - `perCard`
        - `volume`
      - `.self` _(bookable account)_
  - `disputes`
    - `schemes`
      - `$scheme_id`
        - `open`
          - `$dispute_id`
          - `.self` _(bookable account)_
- `counterparties`
  - `schemes`
    - `$scheme_id`
      - `settlement`
  - `binSponsors`
    - `$sponsor_id`

## Transactions

### `CARDHOLDER_LOAD`

Cardholder loads prefunded balance from the partner-bank custody pool

interpreter: `experimental`

```numscript
vars {
  account $bank_id
  account $cardholder_id
  string $load_id
  monetary $amount
}

send $amount (
  source = @platform:banks:$bank_id:custody allowing unbounded overdraft
  destination = @cardholders:$cardholder_id:available
)

set_tx_meta("event_type", "cardholder_load")
set_tx_meta("load_id", $load_id)
```

### `CARD_AUTHORIZATION`

Authorization hold reserves cardholder available funds

interpreter: `experimental`

```numscript
vars {
  account $cardholder_id
  string $authorization_id
  monetary $amount
}

send $amount (
  source = @cardholders:$cardholder_id:available
  destination = @cardholders:$cardholder_id:holds:$authorization_id
)

set_tx_meta("event_type", "card_authorization")
set_tx_meta("authorization_id", $authorization_id)
```

### `CARD_AUTH_REVERSAL`

Authorization reversed; hold released to available

interpreter: `experimental`

```numscript
vars {
  account $cardholder_id
  string $authorization_id
  monetary $amount
}

send $amount (
  source = @cardholders:$cardholder_id:holds:$authorization_id
  destination = @cardholders:$cardholder_id:available
)

set_tx_meta("event_type", "card_auth_reversal")
set_tx_meta("adjustment_flag", "true")
set_tx_meta("authorization_id", $authorization_id)
```

### `CARD_AUTH_EXPIRY`

Seven-day authorization expiry; hold released to available

interpreter: `experimental`

```numscript
vars {
  account $cardholder_id
  string $authorization_id
  monetary $amount
}

send $amount (
  source = @cardholders:$cardholder_id:holds:$authorization_id
  destination = @cardholders:$cardholder_id:available
)

set_tx_meta("event_type", "card_auth_expiry")
set_tx_meta("adjustment_flag", "true")
set_tx_meta("authorization_id", $authorization_id)
```

### `CARD_CAPTURE`

Capture converts an auth hold into captured funds toward the scheme

interpreter: `experimental`

```numscript
vars {
  account $cardholder_id
  string $authorization_id
  string $scheme_id
  string $capture_id
  monetary $capture_amount
}

send $capture_amount (
  source = {
    @cardholders:$cardholder_id:holds:$authorization_id
    @cardholders:$cardholder_id:available
  }
  destination = @platform:clearing:schemes:$scheme_id:captured
)

set_tx_meta("event_type", "card_capture")
set_tx_meta("capture_id", $capture_id)
set_tx_meta("authorization_id", $authorization_id)
```

### `CARD_REFUND`

Refund returns scheme funds to the cardholder available balance

interpreter: `experimental`

```numscript
vars {
  account $cardholder_id
  string $scheme_id
  string $refund_id
  string $original_capture_id
  monetary $amount
}

send $amount (
  source = @counterparties:schemes:$scheme_id:settlement allowing unbounded overdraft
  destination = @cardholders:$cardholder_id:available
)

set_tx_meta("event_type", "card_refund")
set_tx_meta("adjustment_flag", "true")
set_tx_meta("refund_id", $refund_id)
set_tx_meta("adjusted_posting_event_id", $original_capture_id)
```

### `NETWORK_CLEARING`

Clearing file books the settlement position and accrues interchange

interpreter: `experimental`

```numscript
vars {
  string $scheme_id
  string $program_id
  string $clearing_id
  monetary $cleared_amount
  monetary $interchange
}

send $cleared_amount (
  source = @platform:clearing:schemes:$scheme_id:captured
  destination = @counterparties:schemes:$scheme_id:settlement
)

send $interchange (
  source = @counterparties:schemes:$scheme_id:settlement allowing unbounded overdraft
  destination = @platform:revenue:interchange:$program_id:accrued
)

set_tx_meta("event_type", "network_clearing")
set_tx_meta("clearing_id", $clearing_id)
set_tx_meta("program_id", $program_id)
```

### `SCHEME_SETTLEMENT`

Net scheme position settles as cash into the settlement bank account

interpreter: `experimental`

```numscript
vars {
  account $bank_id
  string $scheme_id
  string $settlement_id
  monetary $net_amount
}

send $net_amount (
  source = @counterparties:schemes:$scheme_id:settlement
  destination = @platform:banks:$bank_id:settlement
)

set_tx_meta("event_type", "scheme_settlement")
set_tx_meta("settlement_id", $settlement_id)
```

### `INTERCHANGE_SETTLEMENT`

Accrued interchange reclassified to settled on scheme confirmation

interpreter: `experimental`

```numscript
vars {
  string $program_id
  string $settlement_id
  monetary $amount
}

send $amount (
  source = @platform:revenue:interchange:$program_id:accrued
  destination = @platform:revenue:interchange:$program_id:settled
)

set_tx_meta("event_type", "interchange_settlement")
set_tx_meta("settlement_id", $settlement_id)
set_tx_meta("program_id", $program_id)
```

### `CHARGEBACK_OPENED`

Dispute opened; funds clawed back from the scheme into a per-dispute hold

interpreter: `experimental`

```numscript
vars {
  string $scheme_id
  string $dispute_id
  monetary $amount
}

send $amount (
  source = @counterparties:schemes:$scheme_id:settlement allowing unbounded overdraft
  destination = @platform:disputes:schemes:$scheme_id:open:$dispute_id
)

set_tx_meta("event_type", "chargeback_opened")
set_tx_meta("dispute_id", $dispute_id)
```

### `CHARGEBACK_WON`

Representment won; dispute funds returned to the scheme

interpreter: `experimental`

```numscript
vars {
  string $scheme_id
  string $dispute_id
  monetary $amount
}

send $amount (
  source = @platform:disputes:schemes:$scheme_id:open:$dispute_id
  destination = @counterparties:schemes:$scheme_id:settlement
)

set_tx_meta("event_type", "chargeback_won")
set_tx_meta("dispute_id", $dispute_id)
```

### `CHARGEBACK_LOST`

Representment lost; dispute funds credited to the cardholder

interpreter: `experimental`

```numscript
vars {
  account $cardholder_id
  string $scheme_id
  string $dispute_id
  monetary $amount
}

send $amount (
  source = @platform:disputes:schemes:$scheme_id:open:$dispute_id
  destination = @cardholders:$cardholder_id:available
)

set_tx_meta("event_type", "chargeback_lost")
set_tx_meta("dispute_id", $dispute_id)
```

### `BIN_SPONSOR_CARD_FEE`

Per-card monthly BIN sponsor fee accrued as an obligation

interpreter: `experimental`

```numscript
vars {
  account $sponsor_id
  string $program_id
  string $fee_id
  monetary $amount
}

send $amount (
  source = @counterparties:binSponsors:$sponsor_id allowing unbounded overdraft
  destination = @platform:expense:binSponsor:$program_id:perCard
)

set_tx_meta("event_type", "bin_sponsor_card_fee")
set_tx_meta("fee_id", $fee_id)
set_tx_meta("program_id", $program_id)
```

### `BIN_SPONSOR_VOLUME_FEE`

Basis-points-on-volume BIN sponsor fee accrued as an obligation

interpreter: `experimental`

```numscript
vars {
  account $sponsor_id
  string $program_id
  string $fee_id
  monetary $amount
}

send $amount (
  source = @counterparties:binSponsors:$sponsor_id allowing unbounded overdraft
  destination = @platform:expense:binSponsor:$program_id:volume
)

set_tx_meta("event_type", "bin_sponsor_volume_fee")
set_tx_meta("fee_id", $fee_id)
set_tx_meta("program_id", $program_id)
```

### `BIN_SPONSOR_PAYMENT`

Platform pays the outstanding BIN sponsor obligation from the settlement bank

interpreter: `experimental`

```numscript
vars {
  account $bank_id
  account $sponsor_id
  string $payment_id
  monetary $debt = overdraft(@counterparties:binSponsors:$sponsor_id, USD/2)
}

send $debt (
  source = @platform:banks:$bank_id:settlement allowing unbounded overdraft
  destination = @counterparties:binSponsors:$sponsor_id
)

set_tx_meta("event_type", "bin_sponsor_payment")
set_tx_meta("payment_id", $payment_id)
```

## Queries

### `one_cardholder_available_versus_held`

**One cardholder available versus held**

Returns every account in one cardholder's subtree, including available and each open hold, with the current balance per asset.

resource: `accounts` · vars: `cardholder_id`

```json
{
  "$match": {
    "address": "cardholders:${cardholder_id}:"
  }
}
```

### `open_holds_for_one_cardholder`

**Open holds for one cardholder**

Returns one cardholder's open authorization holds. Each non-zero hold is an authorization that has not yet captured, reversed, or expired.

resource: `accounts` · vars: `cardholder_id`

```json
{
  "$match": {
    "address": "cardholders:${cardholder_id}:holds:"
  }
}
```

### `total_cardholder_liability`

**Total cardholder liability**

Sums the available balance across every cardholder into one per-asset total. This is the platform's total spendable prefunded liability.

resource: `accounts`

```json
{
  "$match": {
    "address": "cardholders::available"
  }
}
```

### `total_cardholder_holds`

**Total cardholder holds**

Sums every open hold across every cardholder. Total cardholder claim equals this plus total cardholder available.

resource: `accounts`

```json
{
  "$match": {
    "address": "cardholders::holds:"
  }
}
```

### `cardholder_claims_versus_custody_backing`

**Cardholder claims versus custody backing**

Sums all cardholder claims (available plus holds) for comparison against the pooled custody backing at the partner bank.

resource: `accounts`

```json
{
  "$or": [
    {
      "$match": {
        "address": "cardholders::available"
      }
    },
    {
      "$match": {
        "address": "cardholders::holds:"
      }
    }
  ]
}
```

### `cleared_but_not_yet_settled`

**Cleared but not yet settled**

Returns the scheme settlement position per scheme. The ledger side of the daily three-way match against the network clearing file.

resource: `accounts`

```json
{
  "$match": {
    "address": "counterparties:schemes::settlement"
  }
}
```

### `settlement_landed_in_the_bank`

**Settlement landed in the bank**

Returns the settlement bank account balance, which is the cash the scheme has actually settled.

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:banks::settlement"
  }
}
```

### `interchange_accrued_versus_settled_per_program`

**Interchange accrued versus settled per program**

Returns accrued and settled interchange for every program, side by side. The per-program accrued-versus-settled reporting grain.

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:revenue:interchange:"
  }
}
```

### `interchange_accrued_over_a_day_per_program`

**Interchange accrued over a day per program**

Volume into the accrued interchange account over a daily window, per program. Use for the daily interchange-earned figure rather than the running balance.

resource: `volumes`

```json
{
  "$match": {
    "address": "platform:revenue:interchange::accrued"
  }
}
```

### `open_disputes_across_schemes`

**Open disputes across schemes**

Returns every open per-dispute account with a non-zero balance. Each non-zero account is a dispute awaiting representment outcome.

resource: `accounts`

```json
{
  "$and": [
    {
      "$match": {
        "address": "platform:disputes:schemes::open:"
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

### `one_dispute_lifecycle_audit`

**One dispute lifecycle audit**

Returns every transaction that touched one dispute account, in either direction: the open event, and the won or lost terminal event.

resource: `transactions` · vars: `scheme_id`, `dispute_id`

```json
{
  "$match": {
    "account": "platform:disputes:schemes:${scheme_id}:open:${dispute_id}"
  }
}
```

### `bin_sponsor_outstanding_obligation`

**BIN sponsor outstanding obligation**

Returns the running balance the platform owes the BIN sponsor. The balance runs negative as fees accrue and rises toward zero on payment.

resource: `accounts` · vars: `sponsor_id`

```json
{
  "$match": {
    "address": "counterparties:binSponsors:${sponsor_id}"
  }
}
```

### `bin_sponsor_expense_by_program_and_fee_type`

**BIN sponsor expense by program and fee type**

Returns cumulative BIN sponsor expense broken out by program and by fee type (per-card and volume). The per-program fee reporting grain.

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:expense:binSponsor:"
  }
}
```

### `cardholder_load_volume_over_a_period`

**Cardholder load volume over a period**

Volume into cardholder available balances over a period, summed across all cardholders.

resource: `volumes`

```json
{
  "$match": {
    "address": "cardholders::available"
  }
}
```
