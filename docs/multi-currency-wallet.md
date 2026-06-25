<!-- Generated from schemas/multi-currency-wallet.yaml by tools/render-md.ts. Do not edit. -->
# Multi-currency Wallet

> Per-user multi-asset wallets with an exchange liquidity pool.

`wallet` · `fx` · `multi-currency`

**6 accounts · 0 transactions · 0 queries**

## Chart of accounts

- `users`
  - `$user_id`
    - `.pattern`
    - `wallet`
      - `USD`
        - `.self` _(bookable account)_
      - `EUR`
        - `.self` _(bookable account)_
      - `BTC`
        - `.self` _(bookable account)_
- `exchange`
  - `liquidity`
    - `USD`
      - `.self` _(bookable account)_
    - `EUR`
      - `.self` _(bookable account)_
  - `fees`
    - `.self` _(bookable account)_
