<!-- Generated from schemas/lending-platform.yaml by tools/render-md.ts. Do not edit. -->
# Lending Platform

> Borrower principal and interest with lender funding pools.

`lending` · `loans` · `interest`

**6 accounts · 0 transactions · 0 queries**

## Chart of accounts

- `borrowers`
  - `$borrower_id`
    - `.pattern`
    - `principal`
      - `.self` _(bookable account)_
      - `.metadata`
    - `interest`
      - `.self` _(bookable account)_
- `lenders`
  - `$lender_id`
    - `.pattern`
    - `available`
      - `.self` _(bookable account)_
    - `deployed`
      - `.self` _(bookable account)_
- `loans`
  - `$loan_id`
    - `.pattern`
    - `outstanding`
      - `.self` _(bookable account)_
    - `payments`
      - `.self` _(bookable account)_
