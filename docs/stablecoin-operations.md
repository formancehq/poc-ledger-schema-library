<!-- Generated from schemas/stablecoin-operations.yaml by tools/render-md.ts. Do not edit. -->
# Stablecoin Operations

> Onramp/offramp business: PSP fiat ↔ stablecoin via pivot accounts, with circulation tracking.

`stablecoin` · `onramp-offramp` · `psp`

**13 accounts · 7 transactions · 7 queries**

## Chart of accounts

- `psp`
  - `$psp_id`
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
    - `withdrawal`
      - `$transfer_ref`
        - `.self` _(bookable account)_
- `blockchain`
  - `$network`
    - `.pattern`
    - `circulating`
      - `.self` _(bookable account)_
      - `.metadata`
    - `mint_in_flight`
      - `.self` _(bookable account)_
    - `burn_in_flight`
      - `.self` _(bookable account)_
- `clients`
  - `$client_id`
    - `.pattern`
    - `stablecoin`
      - `.self` _(bookable account)_
      - `.metadata`
- `platform`
  - `pivot`
    - `stablecoin_issuance`
      - `.self` _(bookable account)_
      - `.metadata`
  - `expenses`
    - `payment_fees`
      - `.self` _(bookable account)_
    - `gas_fees`
      - `.self` _(bookable account)_
  - `revenue`
    - `transaction_fees`
      - `.self` _(bookable account)_
  - `reserves`
    - `backing_stablecoins`
      - `.self` _(bookable account)_
    - `pending_withdrawal`
      - `.self` _(bookable account)_

## Transactions

### `ONRAMP_STEP1_PAYMENT_AUTH_CREDIT`

Payment authorization and immediate stablecoin credit. User initiates a fiat payment (card, instant payment) and receives stablecoins immediately. PSP fiat flows through a pivot account that converts it into the equivalent stablecoin for the user.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $fiat_asset
    asset $stable_asset
    number $fiat_amount
    number $stable_amount
    account $psp_id
    account $client_id
    string $authorization_id
}

send [$fiat_asset $fiat_amount] (
    source = @psp:$psp_id:main allowing unbounded overdraft
    destination = @platform:pivot:stablecoin_issuance
)

send [$stable_asset $stable_amount] (
    source = @platform:pivot:stablecoin_issuance allowing unbounded overdraft
    destination = @clients:$client_id:stablecoin
)

set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("type", "payment_authorization_stablecoin_credit")
```

### `ONRAMP_STEP2_MINT_INSTRUCTION`

Blockchain mint instruction. Platform initiates the mint transaction on the blockchain to create the stablecoins that back the user's balance. Moves the stablecoin obligation from the pivot account to a mint in-flight tracking account.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $stable_asset
    number $stable_amount
    account $network
    string $mint_tx_hash
    string $authorization_id
}

send [$stable_asset $stable_amount] (
    source = @blockchain:$network:mint_in_flight allowing unbounded overdraft
    destination = @platform:pivot:stablecoin_issuance
)

set_tx_meta("mint_tx_hash", $mint_tx_hash)
set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("type", "mint_instruction")
```

### `ONRAMP_STEP3_MINT_CONFIRMATION`

Blockchain mint confirmation. The stablecoins are now officially in circulation on-chain, backing the user's balance. The in-flight mint resolves as circulating supply increases.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $stable_asset
    number $stable_amount
    account $network
    string $mint_tx_hash
    string $block_number
}

send [$stable_asset $stable_amount] (
    source = @blockchain:$network:circulating allowing unbounded overdraft
    destination = @blockchain:$network:mint_in_flight
)

set_tx_meta("mint_tx_hash", $mint_tx_hash)
set_tx_meta("block_number", $block_number)
set_tx_meta("type", "mint_confirmation")
```

### `ONRAMP_STEP4_PSP_SETTLEMENT`

PSP/bank settlement. The PSP settles fiat to your bank account, typically net of processing fees. Resolves the fiat side of the pivot account, completing the full backing cycle.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $fiat_asset
    number $net_amount
    number $fee_amount
    account $psp_id
    account $bank_id
    string $settlement_ref
}

send [$fiat_asset $net_amount] (
    source = @banks:$bank_id:main allowing unbounded overdraft
    destination = @psp:$psp_id:main
)

send [$fiat_asset $fee_amount] (
    source = @platform:expenses:payment_fees allowing unbounded overdraft
    destination = @psp:$psp_id:main
)

set_tx_meta("settlement_ref", $settlement_ref)
set_tx_meta("type", "psp_settlement")
```

### `OFFRAMP_STEP1_BURN_INSTRUCTION`

Burn instruction. User requests fiat withdrawal and their stablecoins are locked. Platform initiates a burn transaction on the blockchain to permanently remove the tokens from circulation.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $stable_asset
    number $stable_amount
    account $network
    account $client_id
    string $burn_tx_hash
}

send [$stable_asset $stable_amount] (
    source = @clients:$client_id:stablecoin
    destination = @blockchain:$network:burn_in_flight
)

set_tx_meta("burn_tx_hash", $burn_tx_hash)
set_tx_meta("type", "burn_instruction")
```

### `OFFRAMP_STEP2_BURN_CONFIRMATION`

Burn confirmation. Blockchain confirms the burn transaction. Stablecoins are permanently removed from circulation, and corresponding fiat is released from the pivot account to pending withdrawal reserves.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $fiat_asset
    asset $stable_asset
    number $fiat_amount
    number $stable_amount
    account $network
    account $client_id
    string $burn_tx_hash
    string $block_number
}

send [$stable_asset $stable_amount] (
    source = @blockchain:$network:burn_in_flight
    destination = @blockchain:$network:circulating
)

send [$fiat_asset $fiat_amount] (
    source = @platform:pivot:stablecoin_issuance
    destination = @platform:reserves:pending_withdrawal
)

set_tx_meta("burn_tx_hash", $burn_tx_hash)
set_tx_meta("block_number", $block_number)
set_tx_meta("client_id", $client_id)
set_tx_meta("type", "burn_confirmation")
```

### `OFFRAMP_STEP3_FIAT_WITHDRAWAL`

Fiat withdrawal. Platform initiates a bank transfer to send fiat to the client. Moves funds from pending withdrawal reserves to an in-flight withdrawal account tied to a specific transfer reference.

```numscript
#![feature("experimental-account-interpolation")]
vars {
    asset $fiat_asset
    number $fiat_amount
    account $bank_id
    account $client_id
    string $transfer_ref
}

send [$fiat_asset $fiat_amount] (
    source = @platform:reserves:pending_withdrawal
    destination = @banks:$bank_id:withdrawal:$transfer_ref
)

set_tx_meta("transfer_ref", $transfer_ref)
set_tx_meta("client_id", $client_id)
set_tx_meta("type", "fiat_withdrawal")
```

## Queries

### `CLIENT_STABLECOIN_BALANCE`

Get a specific client's stablecoin balance

resource: `accounts` · vars: `client_id`

```json
{
  "$match": {
    "address": "clients:${client_id}:stablecoin"
  }
}
```

### `CIRCULATING_SUPPLY`

Total circulating stablecoin supply across all networks

resource: `volumes`

```json
{
  "$match": {
    "address": "blockchain::circulating"
  }
}
```

### `INFLIGHT_MINTS`

All pending mint operations not yet confirmed on-chain

resource: `volumes`

```json
{
  "$match": {
    "address": "blockchain::mint_in_flight"
  }
}
```

### `INFLIGHT_BURNS`

All pending burn operations not yet confirmed on-chain

resource: `volumes`

```json
{
  "$match": {
    "address": "blockchain::burn_in_flight"
  }
}
```

### `PENDING_WITHDRAWALS`

Fiat pending withdrawal to clients

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:reserves:pending_withdrawal"
  }
}
```

### `INFLIGHT_FIAT_WITHDRAWALS`

All in-flight bank withdrawal transfers

resource: `volumes`

```json
{
  "$match": {
    "address": "banks::withdrawal:"
  }
}
```

### `PIVOT_BALANCE`

Platform pivot account balance (should trend to zero when fully settled)

resource: `accounts`

```json
{
  "$match": {
    "address": "platform:pivot:stablecoin_issuance"
  }
}
```
