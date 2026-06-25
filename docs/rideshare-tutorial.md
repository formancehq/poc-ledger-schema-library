<!-- Generated from schemas/rideshare-tutorial.yaml by tools/render-md.ts. Do not edit. -->
# Rideshare (Tutorial)

> Tutorial marketplace: rider charge, driver earnings, platform fee.

`tutorial` · `marketplace` · `rideshare`

**6 accounts · 4 transactions · 0 queries**

## Chart of accounts

- `world`
  - `.self` _(bookable account)_
- `rider`
  - `$rider_id`
    - `ride`
      - `$ride_id`
        - `payment`
          - `.self` _(bookable account)_
- `ride`
  - `$ride_id`
    - `main`
      - `.self` _(bookable account)_
    - `fees`
      - `.self` _(bookable account)_
- `driver`
  - `$driver_id`
    - `ride`
      - `$ride_id`
        - `.self` _(bookable account)_
    - `main`
      - `.self` _(bookable account)_

## Transactions

### `RIDE_BOOKING`

Rider books a ride. Record the estimated payment from the external world into the rider's ride payment account.

interpreter: `experimental` · flags: `experimental-account-interpolation`

```numscript
#![feature("experimental-account-interpolation")]
vars {
    number $amount
    account $rider_id
    account $ride_id
}

send [USD/2 $amount] (
    source = @world
    destination = @rider:$rider_id:ride:$ride_id:payment
)
```

### `RIDE_CONFIRMATION`

RideShare confirms the ride. Transfer the recorded amount from the rider's payment account to the ride's main account.

interpreter: `experimental` · flags: `experimental-account-interpolation`

```numscript
#![feature("experimental-account-interpolation")]
vars {
    number $amount
    account $rider_id
    account $ride_id
}

send [USD/2 $amount] (
    source = @rider:$rider_id:ride:$ride_id:payment
    destination = @ride:$ride_id:main
)
```

### `RIDE_COMPLETION`

Driver finishes the ride and RideShare verifies it. Split the payment between the driver's earnings and RideShare's service fees.

interpreter: `experimental` · flags: `experimental-account-interpolation`

```numscript
#![feature("experimental-account-interpolation")]
vars {
    number $amount
    account $ride_id
    account $driver_id
}

send [USD/2 $amount] (
    source = @ride:$ride_id:main
    destination = {
        10% to @ride:$ride_id:fees
        remaining to @driver:$driver_id:main
    }
)
```

### `DRIVER_PAYOUT`

Driver requests withdrawal. Transfer all accumulated earnings back to the external world.

interpreter: `experimental` · flags: `experimental-account-interpolation`

```numscript
#![feature("experimental-account-interpolation")]
vars {
    account $driver_id
}

send [USD/2 *] (
    source = @driver:$driver_id:main
    destination = @world
)
```
