<!-- Generated from schemas/crypto-custody.yaml by tools/render-md.ts. Do not edit. -->
# Crypto Custody

> Multi-asset entitlements with on-chain reconciliation.

`crypto` · `custody` · `reconciliation`

**18 accounts · 16 transactions · 14 queries**

## Chart of accounts

- `customers`
  - `$customerId`
    - `.pattern`
    - `cash`
      - `pending`
      - `available`
    - `crypto`
      - `confirming`
      - `available`
    - `withdrawals`
      - `$withdrawalId`
        - `.pattern`
        - `pending`
    - `.self` _(bookable account)_
- `fbo`
  - `bank`
    - `$bankId`
      - `.pattern`
      - `settled`
      - `inTransit`
    - `.self` _(bookable account)_
- `platform`
  - `custody`
    - `hot`
      - `$network`
        - `.pattern`
      - `.self` _(bookable account)_
    - `$custodian`
      - `.pattern`
      - `omnibus`
  - `treasury`
    - `gas`
      - `$network`
        - `.pattern`
  - `revenue`
    - `spread`
  - `expense`
    - `networkFees`
  - `suspense`
    - `deposits`
- `counterparties`
  - `otcDesk`
- `exchanges`
  - `conv`
    - `$conversionId`
      - `.pattern`
    - `.self` _(bookable account)_
- `external`
  - `ach`
  - `wire`
  - `$network`
    - `.pattern`
    - `$address`
      - `.pattern`

## Transactions

### `FIAT_DEPOSIT_INITIATE`

Customer USD arrives by ACH or wire and is credited as pending

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $bank_id
  monetary $amount
  string $deposit_id
}

send $amount (
  source = @fbo:bank:$bank_id:inTransit allowing unbounded overdraft
  destination = @customers:$customer_id:cash:pending
)

set_tx_meta("event_type", "fiat_deposit_initiate")
set_tx_meta("deposit_id", $deposit_id)
```

### `FIAT_DEPOSIT_SETTLE`

ACH or wire clears at the FBO bank; pending cash becomes available

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $bank_id
  monetary $amount
  string $deposit_id
}

send $amount (
  source = @fbo:bank:$bank_id:settled allowing unbounded overdraft
  destination = @fbo:bank:$bank_id:inTransit
)

send $amount (
  source = @customers:$customer_id:cash:pending
  destination = @customers:$customer_id:cash:available
)

set_tx_meta("event_type", "fiat_deposit_settle")
set_tx_meta("deposit_id", $deposit_id)
```

### `FIAT_WITHDRAWAL_INITIATE`

Reserve customer USD for an outbound ACH or wire

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $bank_id
  monetary $amount
  string $withdrawal_id
}

send $amount (
  source = @customers:$customer_id:cash:available
  destination = @fbo:bank:$bank_id:inTransit
)

set_tx_meta("event_type", "fiat_withdrawal_initiate")
set_tx_meta("withdrawal_id", $withdrawal_id)
```

### `FIAT_WITHDRAWAL_SETTLE`

Outbound ACH or wire clears the FBO bank

interpreter: `experimental`

```numscript
vars {
  account $bank_id
  monetary $amount
  string $withdrawal_id
}

send $amount (
  source = @fbo:bank:$bank_id:inTransit
  destination = @fbo:bank:$bank_id:settled
)

set_tx_meta("event_type", "fiat_withdrawal_settle")
set_tx_meta("withdrawal_id", $withdrawal_id)
```

### `FIAT_WITHDRAWAL_RETURN`

Outbound ACH or wire is returned; reserved cash goes back to available

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $bank_id
  monetary $amount
  string $withdrawal_id
  string $original_posting_id
}

send $amount (
  source = @fbo:bank:$bank_id:inTransit
  destination = @customers:$customer_id:cash:available
)

set_tx_meta("event_type", "fiat_withdrawal_return")
set_tx_meta("withdrawal_id", $withdrawal_id)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $original_posting_id)
```

### `CRYPTO_DEPOSIT_DETECTED`

On-chain deposit observed but not yet confirmed; credited as confirming

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $custodian
  monetary $amount
  string $deposit_id
}

send $amount (
  source = @platform:custody:$custodian:omnibus allowing unbounded overdraft
  destination = @customers:$customer_id:crypto:confirming
)

set_tx_meta("event_type", "crypto_deposit_detected")
set_tx_meta("deposit_id", $deposit_id)
```

### `CRYPTO_DEPOSIT_CONFIRMED`

On-chain deposit reaches confirmation depth; confirming becomes available

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  monetary $amount
  string $deposit_id
}

send $amount (
  source = @customers:$customer_id:crypto:confirming
  destination = @customers:$customer_id:crypto:available
)

set_tx_meta("event_type", "crypto_deposit_confirmed")
set_tx_meta("deposit_id", $deposit_id)
```

### `BUY_TRADE_INITIATE`

Lock customer USD (gross of spread) into a per-trade conversion account

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $conversion_id
  monetary $usd_gross
}

send $usd_gross (
  source = @customers:$customer_id:cash:available
  destination = @exchanges:conv:$conversion_id
)

set_account_meta(@exchanges:conv:$conversion_id, "trade_side", "buy")
set_account_meta(@exchanges:conv:$conversion_id, "customer", $customer_id)
set_account_meta(@exchanges:conv:$conversion_id, "status", "pending")
set_tx_meta("event_type", "buy_trade_initiate")
set_tx_meta("conversion_id", $conversion_id)
```

### `BUY_TRADE_SETTLE`

OTC desk delivers crypto; spread booked; customer credited

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $conversion_id
  account $custodian
  monetary $usd_gross
  monetary $spread
  monetary $crypto_amount
}

send $usd_gross (
  source = @exchanges:conv:$conversion_id
  destination = {
    max $spread to @platform:revenue:spread
    remaining to @counterparties:otcDesk
  }
)

send $crypto_amount (
  source = @counterparties:otcDesk allowing unbounded overdraft
  destination = @exchanges:conv:$conversion_id
)

send $crypto_amount (
  source = @exchanges:conv:$conversion_id
  destination = @customers:$customer_id:crypto:available
)

send $crypto_amount (
  source = @platform:custody:$custodian:omnibus allowing unbounded overdraft
  destination = @counterparties:otcDesk
)

set_account_meta(@exchanges:conv:$conversion_id, "status", "settled")
set_tx_meta("event_type", "buy_trade_settle")
set_tx_meta("conversion_id", $conversion_id)
```

### `SELL_TRADE_INITIATE`

Lock customer crypto into a per-trade conversion account

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $conversion_id
  monetary $crypto_amount
}

send $crypto_amount (
  source = @customers:$customer_id:crypto:available
  destination = @exchanges:conv:$conversion_id
)

set_account_meta(@exchanges:conv:$conversion_id, "trade_side", "sell")
set_account_meta(@exchanges:conv:$conversion_id, "customer", $customer_id)
set_account_meta(@exchanges:conv:$conversion_id, "status", "pending")
set_tx_meta("event_type", "sell_trade_initiate")
set_tx_meta("conversion_id", $conversion_id)
```

### `SELL_TRADE_SETTLE`

OTC desk delivers USD; spread booked; customer credited

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $conversion_id
  account $custodian
  monetary $crypto_amount
  monetary $usd_gross
  monetary $spread
}

send $crypto_amount (
  source = @exchanges:conv:$conversion_id
  destination = @counterparties:otcDesk
)

send $crypto_amount (
  source = @counterparties:otcDesk allowing unbounded overdraft
  destination = @platform:custody:$custodian:omnibus
)

send $usd_gross (
  source = @counterparties:otcDesk allowing unbounded overdraft
  destination = @exchanges:conv:$conversion_id
)

send $usd_gross (
  source = @exchanges:conv:$conversion_id
  destination = {
    max $spread to @platform:revenue:spread
    remaining to @customers:$customer_id:cash:available
  }
)

set_account_meta(@exchanges:conv:$conversion_id, "status", "settled")
set_tx_meta("event_type", "sell_trade_settle")
set_tx_meta("conversion_id", $conversion_id)
```

### `CRYPTO_WITHDRAWAL_INITIATE`

Reserve customer crypto for an outbound on-chain withdrawal

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $withdrawal_id
  monetary $amount
}

send $amount (
  source = @customers:$customer_id:crypto:available
  destination = @customers:$customer_id:withdrawals:$withdrawal_id:pending
)

set_tx_meta("event_type", "crypto_withdrawal_initiate")
set_tx_meta("withdrawal_id", $withdrawal_id)
```

### `CRYPTO_WITHDRAWAL_SETTLE`

Burn customer crypto from the hot wallet to chain; absorb network fee

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $withdrawal_id
  account $network
  monetary $amount
  monetary $network_fee
}

send $amount (
  source = @customers:$customer_id:withdrawals:$withdrawal_id:pending
  destination = @platform:custody:hot:$network
)

send $network_fee (
  source = @platform:expense:networkFees allowing unbounded overdraft
  destination = @platform:treasury:gas:$network
)

set_tx_meta("event_type", "crypto_withdrawal_settle")
set_tx_meta("withdrawal_id", $withdrawal_id)
```

### `CRYPTO_WITHDRAWAL_CANCEL`

Release a reserved crypto withdrawal back to available

interpreter: `experimental`

```numscript
vars {
  account $customer_id
  account $withdrawal_id
  monetary $amount
  string $original_posting_id
}

send $amount (
  source = @customers:$customer_id:withdrawals:$withdrawal_id:pending
  destination = @customers:$customer_id:crypto:available
)

set_tx_meta("event_type", "crypto_withdrawal_cancel")
set_tx_meta("withdrawal_id", $withdrawal_id)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $original_posting_id)
```

### `CUSTODIAN_REFILL`

Move crypto from a custodian to the hot wallet on the same network

interpreter: `experimental`

```numscript
vars {
  account $custodian
  account $network
  monetary $amount
  string $refill_id
}

send $amount (
  source = @platform:custody:hot:$network allowing unbounded overdraft
  destination = @platform:custody:$custodian:omnibus
)

set_tx_meta("event_type", "custodian_refill")
set_tx_meta("refill_id", $refill_id)
```

### `CONVERSION_COMPENSATE`

Reverse a stranded conversion leg back to the customer

interpreter: `experimental`

```numscript
vars {
  account $conversion_id
  account $return_account
  monetary $amount
  string $original_posting_id
}

send $amount (
  source = @exchanges:conv:$conversion_id
  destination = $return_account
)

set_account_meta(@exchanges:conv:$conversion_id, "status", "compensated")
set_tx_meta("event_type", "conversion_compensate")
set_tx_meta("conversion_id", $conversion_id)
set_tx_meta("adjustment_flag", "true")
set_tx_meta("adjusted_posting_event_id", $original_posting_id)
```

## Queries

### `custody_vs_entitlement_parity`

**Custody-vs-entitlement parity: total customer crypto entitlement**

Sums every customer's spendable crypto entitlement, per asset. Aggregate-balances reconciliation against backing; mapped to resource accounts.

resource: `accounts`

```json
{
  "$match": {
    "address": "customers::crypto:available"
  }
}
```

### `hot_wallet_backing`

**Hot-wallet backing**

Backing held across all per-network hot wallets. Aggregate-balances reconciliation; part of the per-asset parity check; mapped to resource accounts.

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:custody:hot:"
  }
}
```

### `per_customer_multi_asset_position`

**Per-customer multi-asset position**

Every account under one customer with its per-asset balance: the customer's full statement across USD, BTC, ETH, and both colored USDC variants.

resource: `accounts`

```json
{
  "$match": {
    "address": "customers:cust001:"
  }
}
```

### `total_customer_entitlement_per_asset`

**Total customer entitlement per asset**

Sums every customer's spendable cash and crypto into one per-asset total: the platform's total liability to customers. Aggregate-balances; mapped to resource accounts.

resource: `accounts`

```json
{
  "$or": [
    {
      "$match": {
        "address": "customers::cash:available"
      }
    },
    {
      "$match": {
        "address": "customers::crypto:available"
      }
    }
  ]
}
```

### `total_custody_backing_per_asset`

**Total custody backing per asset**

Sums all platform crypto backing across every custodian and every hot wallet. Aggregate-balances; mapped to resource accounts.

resource: `accounts`

```json
{
  "$or": [
    {
      "$match": {
        "address": "platform:custody::omnibus"
      }
    },
    {
      "$match": {
        "address": "platform:custody:hot:"
      }
    }
  ]
}
```

### `crypto_reserved_for_pending_withdrawals`

**Crypto reserved for pending withdrawals**

Every per-withdrawal pending account that still holds a balance: crypto reserved for withdrawals initiated but not yet settled or cancelled.

resource: `accounts`

```json
{
  "$match": {
    "address": "customers::withdrawals::pending"
  }
}
```

### `funds_in_flight_pending_and_confirming`

**Funds in-flight (pending and confirming)**

Customer fiat in the ACH/wire clearing window and crypto deposits awaiting confirmation: money credited to a customer but not yet spendable.

resource: `accounts`

```json
{
  "$or": [
    {
      "$match": {
        "address": "customers::cash:pending"
      }
    },
    {
      "$match": {
        "address": "customers::crypto:confirming"
      }
    }
  ]
}
```

### `stuck_conversion_aging`

**Stuck conversion aging**

Per-trade conversion accounts that hold a non-zero balance: a stranded leg that needs a compensating entry.

resource: `accounts`

```json
{
  "$and": [
    {
      "$match": {
        "address": "exchanges:conv:"
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

### `unattributed_deposit_suspense`

**Unattributed deposit suspense**

The deposit suspense balance: incoming funds received but not yet attributed to a customer.

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:suspense:deposits"
  }
}
```

### `daily_spread_revenue`

**Daily spread revenue**

Volume into the platform spread revenue account over the daily window (startTime/endTime URL params): the 75-bps spread earned across all trades that day.

resource: `volumes`

```json
{
  "$match": {
    "address": "platform:revenue:spread"
  }
}
```

### `daily_absorbed_network_fees`

**Daily absorbed network fees**

Volume out of the platform network-fee expense account over the daily window (startTime/endTime URL params): on-chain fees the platform absorbed, read per native asset.

resource: `volumes`

```json
{
  "$match": {
    "address": "platform:expense:networkFees"
  }
}
```

### `per_customer_crypto_throughput`

**Per-customer crypto throughput**

Volume in and out of one customer's spendable crypto balance over a period (startTime/endTime URL params).

resource: `volumes`

```json
{
  "$match": {
    "address": "customers:cust001:crypto:available"
  }
}
```

### `per_customer_transaction_audit`

**Per-customer transaction audit**

Every transaction that touched any account under one customer, in either direction. Used for per-case audit and dispute investigation.

resource: `transactions`

```json
{
  "$match": {
    "account": "customers:cust001:"
  }
}
```

### `fbo_bank_statement_reconciliation`

**FBO bank-statement reconciliation**

Settled and in-transit USD backing held at the FBO bank, matched against the FBO bank's daily statement.

resource: `accounts`

```json
{
  "$match": {
    "address": "fbo:bank:"
  }
}
```
