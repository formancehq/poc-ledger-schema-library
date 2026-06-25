<!-- Generated from schemas/payment-acceptance.yaml by tools/render-md.ts. Do not edit. -->
# Payment Acceptance

> PSP capture, fees, and settlement into the merchant balance.

`payments` · `acceptance` · `psp`

**6 accounts · 4 transactions · 5 queries**

## Chart of accounts

- `acquirers`
  - `$acquirer_id`
    - `.pattern`
    - `main`
      - `.self` _(bookable account)_
      - `.metadata`
- `banks`
  - `$bank_id`
    - `.pattern`
    - `main`
      - `.self` _(bookable account)_
      - `.metadata`
- `clients`
  - `$client_id`
    - `.pattern`
    - `main`
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

## Transactions

### `CARD_AUTHORIZATION_GROSS_TOPUP`

Record a card authorization for a wallet top-up. The full gross amount is immediately available to the end user. The acquirer's captured authorization is treated as an asset — a binding promise to settle.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $asset
    number $amount
    account $acquirer_id
    account $client_id
    account $platform_name
    string $authorization_id
}

send [$asset $amount] (
    source = @acquirers:$acquirer_id:main allowing unbounded overdraft
    destination = @clients:$client_id:main
)

set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("type", "card_authorization_gross_topup")
```

### `ACQUIRER_SETTLEMENT`

Record an acquirer settlement to your bank account. The acquirer settles the net amount (gross minus fees). The bank receives the net settlement and the platform fee account absorbs the difference to zero-out the acquirer balance.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $asset
    number $net_amount
    number $fee_amount
    account $acquirer_id
    account $bank_id
    account $platform_name
    string $settlement_ref
}

send [$asset $net_amount] (
    source = @banks:$bank_id:main allowing unbounded overdraft
    destination = @acquirers:$acquirer_id:main
)

send [$asset $fee_amount] (
    source = @platform:$platform_name:fees allowing unbounded overdraft
    destination = @acquirers:$acquirer_id:main
)

set_tx_meta("settlement_ref", $settlement_ref)
set_tx_meta("type", "acquirer_settlement")
```

### `CARD_REFUND`

Process a refund for a previously captured card payment. Reverses the original booking by debiting the client wallet and crediting the acquirer account.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $asset
    number $amount
    account $acquirer_id
    account $client_id
    string $refund_id
    string $original_authorization_id
}

send [$asset $amount] (
    source = @clients:$client_id:main
    destination = @acquirers:$acquirer_id:main
)

set_tx_meta("refund_id", $refund_id)
set_tx_meta("original_authorization_id", $original_authorization_id)
set_tx_meta("type", "card_refund")
```

### `CHARGEBACK`

Handle a chargeback from the acquirer. Debits the client wallet for the disputed amount and charges the chargeback fee to the platform chargeback fee account.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $asset
    number $amount
    number $chargeback_fee
    account $acquirer_id
    account $client_id
    account $platform_name
    string $chargeback_id
    string $original_authorization_id
}

send [$asset $amount] (
    source = @clients:$client_id:main allowing unbounded overdraft
    destination = @acquirers:$acquirer_id:main
)

send [$asset $chargeback_fee] (
    source = @platform:$platform_name:chargeback_fees allowing unbounded overdraft
    destination = @acquirers:$acquirer_id:main
)

set_tx_meta("chargeback_id", $chargeback_id)
set_tx_meta("original_authorization_id", $original_authorization_id)
set_tx_meta("type", "chargeback")
```

## Queries

### `CLIENT_BALANCE`

Get a specific client's wallet balance

resource: `accounts` · vars: `client_id`

```json
{
  "$match": {
    "address": "clients:${client_id}:main"
  }
}
```

### `ACQUIRER_BALANCE`

Get a specific acquirer's unsettled balance

resource: `accounts` · vars: `acquirer_id`

```json
{
  "$match": {
    "address": "acquirers:${acquirer_id}:main"
  }
}
```

### `UNSETTLED_AUTHORIZATIONS`

All acquirer accounts with outstanding unsettled balances

resource: `volumes`

```json
{
  "$match": {
    "address": "acquirers::main"
  }
}
```

### `PLATFORM_FEES`

All platform fee accounts and their volumes

resource: `volumes`

```json
{
  "$match": {
    "address": "platform::fees"
  }
}
```

### `PLATFORM_CHARGEBACK_FEES`

All platform chargeback fee accounts and their volumes

resource: `volumes`

```json
{
  "$match": {
    "address": "platform::chargeback_fees"
  }
}
```
