<!-- Generated from schemas/ecommerce-platform.yaml by tools/render-md.ts. Do not edit. -->
# E-commerce Platform

> Order capture, marketplace split, and seller payouts.

`ecommerce` · `marketplace` · `payouts`

**8 accounts · 0 transactions · 0 queries**

## Chart of accounts

- `customers`
  - `$customer_id`
    - `.pattern`
    - `wallet`
      - `.self` _(bookable account)_
      - `.metadata`
- `merchants`
  - `$merchant_id`
    - `.pattern`
    - `earnings`
      - `.self` _(bookable account)_
    - `settlements`
      - `.self` _(bookable account)_
- `orders`
  - `$order_id`
    - `.pattern`
    - `pending`
      - `.self` _(bookable account)_
    - `captured`
      - `.self` _(bookable account)_
- `platform`
  - `fees`
    - `.self` _(bookable account)_
  - `taxes`
    - `vat`
      - `.self` _(bookable account)_
  - `refunds`
    - `pool`
      - `.self` _(bookable account)_
