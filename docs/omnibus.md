<!-- Generated from schemas/omnibus.yaml by tools/render-md.ts. Do not edit. -->
# Omnibus / FBO

> Single omnibus bank account with per-client sub-balances.

`omnibus` · `fbo` · `banking`

**6 accounts · 5 transactions · 3 queries**

## Chart of accounts

- `banks`
  - `$bank_id`
    - `.pattern`
    - `main`
      - `.self` _(bookable account)_
      - `.metadata`
    - `payout`
      - `$payout_ref`
        - `.self` _(bookable account)_
- `clients`
  - `$client_id`
    - `.pattern`
    - `main`
      - `.self` _(bookable account)_
      - `.metadata`
- `platform`
  - `$platform_name`
    - `suspense`
      - `payin`
        - `.self` _(bookable account)_
    - `revenue`
      - `fees`
        - `.self` _(bookable account)_
    - `costs`
      - `processing`
        - `.self` _(bookable account)_

## Transactions

### `CLIENT_DEPOSIT`

Record a deposit when funds arrive at your bank account with clear client identification.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $bank_id
  account $client_id
  string $reference
}
send [$asset $amount] (
  source = @banks:$bank_id:main allowing unbounded overdraft
  destination = @clients:$client_id:main
)
set_tx_meta("reference", $reference)
```

### `UNIDENTIFIED_DEPOSIT`

Handle deposits when you cannot immediately identify the client. Funds go to a suspense account for later resolution.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $bank_id
  account $platform_name
  string $reference
}
send [$asset $amount] (
  source = @banks:$bank_id:main allowing unbounded overdraft
  destination = @platform:$platform_name:suspense:payin
)
set_tx_meta("reference", $reference)
set_tx_meta("status", "pending_identification")
```

### `SUSPENSE_RESOLUTION`

Resolve a suspense transaction by moving funds to the identified client account.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $platform_name
  account $client_id
  string $original_reference
}
send [$asset $amount] (
  source = @platform:$platform_name:suspense:payin
  destination = @clients:$client_id:main
)
set_tx_meta("original_reference", $original_reference)
set_tx_meta("resolution_type", "client_identified")
```

### `PAYOUT_RESERVE`

Reserve funds for a client withdrawal. Moves from the client account to a payout staging account tied to a specific reference.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $client_id
  account $bank_id
  string $payout_ref
}
send [$asset $amount] (
  source = @clients:$client_id:main
  destination = @banks:$bank_id:payout:$payout_ref
)
set_tx_meta("payout_ref", $payout_ref)
set_tx_meta("status", "reserved")
```

### `PAYOUT_SETTLEMENT`

Confirm a payout has settled at the bank. Moves from the staging account to the bank's main account.

```numscript
#![feature("experimental-account-interpolation")]
vars {
  asset $asset
  number $amount
  account $bank_id
  string $payout_ref
  string $bank_reference
}
send [$asset $amount] (
  source = @banks:$bank_id:payout:$payout_ref
  destination = @banks:$bank_id:main
)
set_tx_meta("bank_reference", $bank_reference)
set_tx_meta("status", "settled")
```

## Queries

### `CLIENT_BALANCE`

Get a specific client's balance

resource: `accounts` · vars: `client_id`

```json
{
  "$match": {
    "address": "clients:${client_id}:main"
  }
}
```

### `PENDING_SUSPENSE`

All unresolved suspense deposits

resource: `volumes`

```json
{
  "$match": {
    "address": ":suspense:payin"
  }
}
```

### `INFLIGHT_PAYOUTS`

All reserved but unsettled payouts

resource: `volumes`

```json
{
  "$match": {
    "address": ":payout:"
  }
}
```
