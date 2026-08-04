# Devcon gallery templates: coa-designer audit and fix pass

Date: 2026-08-04. Scope: the five new gallery templates in `schemas/` (marketplace-split-payments, digital-wallet, earned-wage-access, loan-servicing, remittance-fx), their FIXTURES stories in `~/Documents/fintech-devcon-booth/mcp-demo/seed.js`, and nothing else. Full coa-designer 0.5.2 knowledge base loaded (all principles, all strategies, designer checklist). Ledger target: v2 (RULE-V3-* treated as forward-compat guidance only, per the v3-readiness applicability rule).

## Method and verification evidence

1. Every account path walked against RULE-FOUNDATION-01, RULE-HARD-01..04, RULE-NAMING-01..10 (incl. 06b), RULE-META-01, RULE-SIGN-01, RULE-STRUCT-01..09, RULE-LIFE-01..04, RULE-ARCH-01..03. Every script walked against RULE-NS-SIZE-01, RULE-NS-IDEM-01, RULE-NS-GRAM-01..10, RULE-NS-AUTH-01..04, RULE-NS-01..03, plus the AP catalog (AP-001..048, AP-098..106). Assets against RULE-ASSET-01..11. Queries against RULE-QUERY-FILTER-01, RULE-QUERY-WILD-01, RULE-QUERY-RES-01, RULE-QUERY-RECON-01/02. Strategy rules applied where triggered (OMNI, GRAN, CONV, LEND; COLOR n/a for all five).
2. **Live wildcard-semantics probe** (scratch ledger `audit-probe-devcon` on the demo stack): trailing `:` is a true subtree prefix (matches depth >= pattern segments; `users:` DOES match `users:x:available` and deeper), `::` is a depth-exact positional wildcard, exact addresses are depth-exact, and an exact parent address that is not an account returns empty. The audit brief's "depth-exact trailing colon" hypothesis is disproved on the live stack; all trailing-colon queries in the five templates are therefore correct as written. Consistent with the earlier finding that the transactions endpoint expands NO address wildcards: both transactions queries in the five templates use metadata matches only.
3. **Live replay** of all five updated FIXTURES stories through seed.js's own `concretize()` against scratch ledgers `audit-ap2-<slug>`: 51/51 transactions accepted, final balances match the hand traces below to the cent.
4. **All 26 queries executed live** against the seeded scratch ledgers with fixture-consistent var values: 26/26 HTTP 200 and non-empty.
5. `numscript check` on all 37 scripts across the five templates: 0 errors. `pnpm validate`: 15 templates, 0 failure(s).
6. The refund's compound source (capped legs plus unbounded catch-all) was unit-run in the numscript CLI for both the normal case (300/200/1500 split) and the reserve-shortfall case (shortfall falls through to the payable), confirming drain-order semantics.

## Library-format deviations accepted by design (all five templates)

- `#![feature("experimental-account-interpolation")]` pragma line in source scripts: library convention, stripped by seed.js at concretize time. RULE-NS-GRAM-01's no-pragma guidance is superseded by the library file format (per audit brief).
- Amount vars passed explicitly instead of `balance()`/`overdraft()` reads (AP-033 tension): required by the library's execution model; concretize strips the vars block and template execution never evaluates derived initializers. Same pattern as the existing corpus (bnpl-lending). Accepted deviation, noted per template below.
- Reversal templates set `adjustment_flag` plus the business key (order_id / transfer_id / shift_id / loan_id) but not `adjusted_posting_event_id` (RULE-NS-AUTH-03 wants both; warning severity). Ledger tx ids are not known at fixture-authoring time in this pipeline; the business key makes the original discoverable. Accepted house style (consistent with the 10 existing templates).
- Several listing queries use `volumes` where `accounts` would be the RULE-QUERY-RES-01 textbook resource. The volumes rows carry balances and render as tables in the studio; the whole 15-template corpus uses this style. Accepted for consistency; flagged, not fixed.

---

## 1. marketplace-split-payments

### Rule walk

| Rule | Verdict | Note |
|---|---|---|
| RULE-FOUNDATION-01 | pass | Roots: external (boundary), platform (owner), sellers (customer-class). Escrow under `platform:escrow:orders:{id}` is the RULE-NAMING-06b exempt no-single-owner bucket; placement inside `platform:` accepted per RULE-STRUCT-06 (escrow held balance is part of the platform's PSP reconciliation position). |
| RULE-HARD-01 | pass | All designed segments `[a-zA-Z0-9_]`, camelCase, colon-separated. |
| RULE-HARD-02 | pass | Every send single-asset; all transactions balance per asset (verified live). |
| RULE-HARD-03 | pass/fixed | Overdraft clauses only where a source legitimately goes negative: PSP boundary (funds in), payable clawback (refund, chargeback), commission clawback (refund). Reserve never carries overdraft, so it can never be over-drained; shortfall falls to payable. |
| RULE-HARD-04 | pass | One `$var` per level; valid `.pattern` regexes (`^[a-z][a-zA-Z0-9_]*$`). |
| RULE-NAMING-01/AP-001 | pass | No `@world`; named `external:psp:{id}` boundary. |
| RULE-NAMING-02/AP-002 | pass | All ids own segments. |
| RULE-NAMING-03 | pass | sellers, orders, payouts plural. |
| RULE-NAMING-04/AP-003 | pass | No asset tokens in paths. |
| RULE-NAMING-05/AP-004/005 | pass | No underscores or fake hierarchy in designed segments. |
| RULE-NAMING-06/06b | pass | Entity-first, status-last; payouts anchor under seller; per-order escrow is the exempt bucket. |
| RULE-NAMING-07..10, AP-098/099 | pass | No dates, no compound states (`held`, `pending` own segments), no parent-id prefixes. |
| RULE-META-01 / RULE-QUERY-01..03 | pass/fixed | Hot dims (seller, order, payout, state) are segments. Dead chart node `platform:expense:chargebacks` removed: no flow touched it, so it failed RULE-QUERY-01's "every segment justifies itself" and invited empty queries. |
| RULE-SIGN-01 | pass | PSP collections mirror runs negative; payables/reserves/commission positive; refunds/chargebacks flow back through the mirror. |
| RULE-STRUCT-01..09 | pass | Transient states trail their entity (escrow:held, payouts:pending); per-entity default; no double-count omnibus; obligations as negative balances on payable (chargeback/refund shortfall). |
| RULE-LIFE-01/02 | pass | Escrow and payout-pending accounts drain to zero (verified live); transient classes identified. |
| RULE-NS-SIZE-01 / GRAM-01..10 / AUTH-01..04 / IDEM-01 | pass/fixed | One event per template; every template sets event_type plus a per-instance key; all vars used. Refund consolidation per RULE-NS-GRAM-10 (three sends sharing destination-and-asset became one compound-source send). |
| AP-021..034 | pass/fixed | AP-023-mirror fixed in the refund (see below). No fixed-before-percentage rounding traps (no portions used). AP-031/032 clean. |
| RULE-ASSET-02..05 | pass | Single scale (USD/2) in fixtures; no bare assets. |
| RULE-QUERY-FILTER-01 / WILD-01 / RES-01 | pass | Bare filter bodies; `platform:escrow:orders::held` and `sellers::payouts::pending` positional counts verified against chart depth; live-verified non-empty. |
| RULE-CONV-*, RULE-LEND-*, RULE-COLOR-*, RULE-OMNI-03..11 | n/a | No conversions, no lending, no colors, no custodian pooling beyond the PSP mirror. |

### Changes

1. **ORDER_REFUNDED_AFTER_SPLIT redesigned (confirmed finding #1).** Old script clawed back only `$seller_share` + `$commission_share`; an order accepted with a nonzero reserve under-refunded the buyer or over-debited the seller payable, and the order's reserve slice was stranded in `sellers:{id}:reserve` forever. New design is the exact inverse of ORDER_ACCEPTED_SPLIT, one atomic send (RULE-NS-GRAM-10, AP-023-mirror) with an in-order compound source: `max $commission_share from @platform:revenue:commission allowing unbounded overdraft`, then `max $reserve_share from @sellers:$seller_id:reserve` (no overdraft: a reserve already consumed by chargebacks falls through), then `@sellers:$seller_id:payable allowing unbounded overdraft` as catch-all (the seller owes the shortfall, RULE-STRUCT-08). Vars: `$seller_share` removed; `$amount` and `$reserve_share` added; `$commission_share` kept. Both the normal and reserve-shortfall drain orders unit-verified in the numscript CLI.
2. **Dead chart node `platform:expense:chargebacks` removed.** No transaction or query referenced it (chargebacks are borne by reserve-then-payable, so seller shortfall is a receivable, not a platform expense).
3. **Fixture story extended** with an ORDER_REFUNDED_AFTER_SPLIT step (partial refund of ord_1001: 2000 = 300 commission + 200 reserve + 1500 payable) between the before-split refund and the chargeback, so the fixed template is exercised. Previously this template was never seeded.

### Amount trace (USD/2 minor units; balances after each step)

| # | Step | Postings | Running balances (non-zero) |
|---|---|---|---|
| 1 | ORDER_CAPTURED ord_1001 8500 | psp:collections -> escrow:1001:held | psp:col -8500; esc1001 +8500 |
| 2 | ORDER_CAPTURED ord_1002 24000 | same | psp:col -32500; esc1002 +24000 |
| 3 | ORDER_CAPTURED ord_1003 15900 | same | psp:col -48400; esc1003 +15900 |
| 4 | ORDER_ACCEPTED_SPLIT ord_1001 (vintagevault; comm 1275, res 850) | esc1001 -> comm/res/payable | esc1001 0; commission +1275; vv.res +850; vv.pay +6375 |
| 5 | ORDER_ACCEPTED_SPLIT ord_1002 (pixelforge; comm 3600, res 2400) | esc1002 -> comm/res/payable | esc1002 0; commission 4875; pf.res 2400; pf.pay 18000 |
| 6 | ORDER_REFUNDED_BEFORE_SPLIT ord_1003 15900 | esc1003 -> psp:col | esc1003 0; psp:col -32500 |
| 7 | ORDER_REFUNDED_AFTER_SPLIT ord_1001 2000 (comm 300, res 200) | comm/res/payable -> psp:col | commission 4575; vv.res 650; vv.pay 4875; psp:col -30500 |
| 8 | CHARGEBACK ord_1001 4000 | {vv.res, vv.pay ubo} -> psp:col | vv.res 0 (650 taken); vv.pay 1525 (3350 taken); psp:col -26500 |
| 9 | RESERVE_RELEASED pixelforge 2400 | pf.res -> pf.pay | pf.res 0; pf.pay 20400 |
| 10 | SELLER_PAYOUT_INITIATED po_501 15000 | pf.pay -> po_501:pending | pf.pay 5400; pending 15000 |
| 11 | SELLER_PAYOUT_SETTLED 15000 | pending -> psp:payouts | pending 0; psp:payouts +15000 |

**Final invariants (live-verified):** all per-order escrow and per-payout pending accounts at 0 (RULE-LIFE-01); reserves 0; `|psp net mirror| = |-26500 + 15000| = 11500 = commission 4575 + payables 6925` (RULE-SIGN-01 / OMNI-01); no account negative except the PSP boundary mirror; ledger sums to 0.

---

## 2. digital-wallet

### Rule walk

| Rule | Verdict | Note |
|---|---|---|
| RULE-FOUNDATION-01 / HARD-01..04 | pass | Roots: external, users, merchants, platform. Patterns valid. |
| RULE-NAMING-01..10 / AP-001..009 | pass | Named bank boundary; holds/withdrawals as owner-anchored transient states (RULE-STRUCT-01 canonical shape `users:{id}:holds:{hold_id}`); states own segments. |
| RULE-META-01 / QUERY-01..03 | pass | user, hold, withdrawal, state all segments; per-case refs in tx metadata. |
| RULE-SIGN-01 / OMNI-01/02 | pass | Bank settlement mirror negative; stored value positive; the invariant reads exactly (see below). |
| RULE-OMNI-11 | pass | Withdrawal is two-phase (pending then settle; mirror moves only at settle). Topup and merchant settlement are modeled as single settlement events, stated in the descriptions. |
| RULE-STRUCT-01..09 / LIFE-01..04 | pass | Per-entity default; holds and pending drain to zero (verified); no omnibus double-count. |
| RULE-NS-* / AP-021..034 | pass | HOLD_CAPTURE's release-then-capture chain kept per RULE-NS-GRAM-10's counter-guidance (consolidating would contort destination grammar; the two legs are distinct semantics in one atomic tx). All templates carry event_type + instance key (RULE-NS-IDEM-01). All vars used. |
| RULE-ASSET-* | pass | Monetary vars carry the asset; no hardcoded asset literals anywhere in this template. |
| RULE-QUERY-FILTER/WILD/RES/RECON | pass/fixed | `users::holds:`, `users::withdrawals::pending`, `external:banks::settlement` colon counts verified live. FLOAT_COVERAGE description tightened: the mirror's magnitude backs wallets + merchant payables + platform fees, not wallets alone (RULE-QUERY-RECON-01 discipline: say precisely what the asset side backs). |
| CONV/LEND/COLOR/GRAN-AMORT | n-a | |

### Changes

1. **FLOAT_COVERAGE query description corrected** (was "backing the wallets"; the magnitude equals wallets + merchant payables + platform fees). Query body untouched. No script, chart, or fixture changes; no signature changes.

### Amount trace (USD/2)

| # | Step | Postings | Running balances (non-zero) |
|---|---|---|---|
| 1 | WALLET_TOPUP maya 50000 | bank -> maya:available | bank -50000; maya 50000 |
| 2 | WALLET_TOPUP leo 20000 | bank -> leo:available | bank -70000; leo 20000 |
| 3 | P2P_TRANSFER maya->leo 7500 | available -> available | maya 42500; leo 27500 |
| 4 | MERCHANT_PAYMENT maya 1200 (fee 36) | maya -> {fees, brewbar} | maya 41300; fees 36; brewbar 1164 |
| 5 | PAYMENT_HOLD leo 6000 | leo -> holds:hold_001 | leo 21500; hold 6000 |
| 6 | HOLD_CAPTURE 6000/5500 (fee 165) | hold -> leo; leo -> {fees, brewbar} | hold 0; leo 22000; fees 201; brewbar 6499 |
| 7 | WALLET_WITHDRAWAL_INITIATED maya 20000 | maya -> wd_001:pending | maya 21300; pending 20000 |
| 8 | WALLET_WITHDRAWAL_SETTLED 20000 | pending -> bank | pending 0; bank -50000 |
| 9 | MERCHANT_SETTLEMENT brewbar 6499 | brewbar -> bank | brewbar 0; bank -43501 |

**Final invariants (live-verified):** TOTAL_WALLET_LIABILITY = 43300 (maya 21300 + leo 22000); FLOAT_COVERAGE = -43501; `|float| = wallets 43300 + payables 0 + fees 201` exactly; holds and pending at 0; only the bank mirror negative.

---

## 3. earned-wage-access

### Rule walk

| Rule | Verdict | Note |
|---|---|---|
| RULE-FOUNDATION-01 / HARD-01..04 | pass | Roots: external, employers, employees, platform. |
| RULE-NAMING-01..10 | pass | `earned:accrued` and `advances:{id}:disbursed` states own segments (RULE-NAMING-09); `payrollFunding`/`advanceFees` camelCase (RULE-NAMING-05); advances anchor under the employee (RULE-NAMING-06b). |
| RULE-SIGN-01 / OMNI-01 | pass | Bank operating mirror negative-running; funding and earned balances positive. |
| RULE-STRUCT-01..09 / LIFE-01 | pass | Prefund-first model: accruals draw down employer funding, no overdraft, so the ledger enforces funding coverage. Per-advance tracker drains to zero in the same tx (verified). |
| RULE-NS-SIZE/GRAM/AUTH/IDEM | pass/fixed | ADVANCE_DISBURSED fixed (below). All templates set event_type + instance key; ACCRUAL_ADJUSTED sets adjustment_flag + shift_id. All vars used. |
| AP-104 / RULE-NS-GRAM-05 | fixed | The `send [USD/2 *]` sweep (legal but asset-hardcoded) is gone; no send-all remains in the template. |
| RULE-ASSET-02..05 | pass/fixed | After the fix the scripts are asset-agnostic; fixtures carry USD/2 consistently. |
| RULE-LEND-FEE-01 | pass | The advance fee is a point-of-transaction fee collected at disbursement (no time gap between assessment and collection), so immediate recognition is correct; no receivable exists (EWA draws are not loans here). |
| RULE-QUERY-* | pass | `employees::earned:accrued` depth verified; ADVANCES_TAKEN uses a transactions metadata match (correct: the transactions endpoint expands no address wildcards). |
| CONV/COLOR/GRAN-AMORT | n-a | |

### Changes

1. **ADVANCE_DISBURSED restructured** (same defect class as confirmed finding #2): the second send was `send [USD/2 *]` sweeping the per-advance tracker to the bank. Running the template in any non-USD currency would silently sweep nothing and strand the net advance on the tracker. New shape: send 1 moves the gross draw `$amount` from `earned:accrued` into the per-advance tracker (its volume_in now reports gross draws per advance, an audit hop per RULE-NS-GRAM-10); send 2 moves the same `$amount` out of the tracker into `{max $fee to advanceFees, remaining to bank}`. No wildcard sweep, no hardcoded asset, tracker still nets to zero in-transaction (RULE-LIFE-01). **Var signature unchanged; fixtures unchanged; final balances identical to the old shape.**

### Amount trace (USD/2)

| # | Step | Postings | Running balances (non-zero) |
|---|---|---|---|
| 1 | EMPLOYER_PREFUND shiftco 500000 | bank -> funding | bank -500000; funding 500000 |
| 2 | WAGES_ACCRUED rosa 14400 | funding -> rosa earned | funding 485600; rosa 14400 |
| 3 | WAGES_ACCRUED denny 12800 | funding -> denny earned | funding 472800; denny 12800 |
| 4 | WAGES_ACCRUED rosa 14400 | funding -> rosa earned | funding 458400; rosa 28800 |
| 5 | ADVANCE_DISBURSED rosa 10000 (fee 299) | earned -> adv_001; adv_001 -> {fees, bank} | rosa 18800; adv_001 0; fees 299; bank -490299 |
| 6 | ACCRUAL_ADJUSTED denny 1600 | earned -> funding | denny 11200; funding 460000 |
| 7 | PAYROLL_RUN rosa 18800 | earned -> bank | rosa 0; bank -471499 |
| 8 | PAYROLL_RUN denny 11200 | earned -> bank | denny 0; bank -460299 |
| 9 | EMPLOYER_FUNDING_RETURNED 460000 | funding -> bank | funding 0; bank -299 |

**Final invariants (live-verified):** everything zero except `platform:revenue:advanceFees = +299` and the bank mirror `-299`; `|mirror| = fee revenue` exactly; employer funding never went negative (minimum reached 458400).

---

## 4. loan-servicing

### Rule walk

| Rule | Verdict | Note |
|---|---|---|
| RULE-FOUNDATION-01 / HARD-01..04 | pass | Roots: external, borrowers, platform. |
| RULE-NAMING-06b | pass | Loans anchor under borrowers. |
| RULE-NAMING-09 / AP-098 | pass | `principal:outstanding`, `principal:chargedOff`, `interest:receivable`, `fees:receivable` all state-in-own-segment. |
| RULE-GRAN-CHECK-01/02, RULE-QUERY-01 | **fixed** | Late fees accrued into `interest:receivable`, commingling two components. "Late fees owed on this loan / across the book" was an unanswerable balance question, and the waterfall could not order fees before interest. Added `fees:receivable` under the loan and repointed LATE_FEE_ASSESSED at it. |
| AP-034 / RULE-LEND-WRITE-01 | **fixed** | LOAN_CHARGED_OFF reversed only interest revenue; unpaid late fees sitting in the interest receivable would have been reversed against `revenue:interest` (a line they never credited), misstating both revenue lines. Now each revenue line reverses its own receivable (Net presentation under Model A, applied per line). |
| RULE-LEND-REV-01/03 | pass | Model A (strict accrual) chosen and consistently applied for interest and fees; charge-off uses Net presentation (revenue reversal) for interest/fees plus a bucket move for principal (receivable relocates to `principal:chargedOff` so recoveries track against it). Documented here as the recognition model. |
| RULE-LEND-FEE-01 | pass/fixed | Fees now follow the same recognition model as interest (accrue to own receivable, recognize at assessment, reverse at charge-off). |
| RULE-LEND-NONACCRUAL-01 | pass | No status segments in paths; charge-off status is carried by the account bucket that genuinely holds money (`chargedOff`) plus tx metadata. |
| PAT-WATERFALL-REGZ / AP-024 | pass/fixed | Waterfall now fees -> interest -> escrow -> principal(remaining), the canonical consumer-credit ordering; capped legs then remaining, no portions, no rounding trap. |
| RULE-SIGN-01 | pass | Receivables negative (Convention B accrual: source with unbounded overdraft); revenue positive; discharge sends into the receivable (PAT-SETTLEMENT Convention B mirrored correctly, AP-034 checked per flow). |
| RULE-STRUCT-01 | pass | Per-loan `suspense` is the loan's own unallocated-payment state, correctly anchored under the loan, drains to zero (RULE-LIFE-01, verified). |
| RULE-NS-* / IDEM-01 | pass | Every template sets event_type plus loan_id/payment_id/period_id/recovery_id/disbursement_id; all vars used; charge-off sets adjustment_flag. |
| RULE-QUERY-FILTER/WILD/RES | pass/fixed | LOAN_POSITION's second `$or` arm (`...:loans:${loan_id}::`) was strictly redundant (live-verified: the trailing-colon arm already matches depth >= 5, covering escrow/suspense at 5 and the two-segment buckets at 6); simplified to the single prefix match. Added FEES_OUTSTANDING so the new segment is query-justified (RULE-QUERY-01). `borrowers::loans::principal:outstanding` and friends colon-counted against the chart and live-verified. |
| CONV/COLOR/OMNI | n-a | |

### Changes

1. **Chart:** added `fees: { receivable: {} }` under `$loan_id`.
2. **LATE_FEE_ASSESSED:** source repointed from `interest:receivable` to `fees:receivable` (signature unchanged, behavior changed).
3. **PAYMENT_APPLIED:** added `monetary $fees_due` and a `max $fees_due to ...fees:receivable` leg at the top of the waterfall (signature changed).
4. **LOAN_CHARGED_OFF:** added `monetary $fees_remaining` and a third send reversing `revenue:lateFees` into `fees:receivable` (signature changed). Description updated.
5. **LOAN_POSITION query** simplified to one prefix match; **FEES_OUTSTANDING query added** (balances over `borrowers::loans::fees:receivable`).
6. **Fixtures:** LATE_FEE_ASSESSED added for both loans (harper 700, quinn 600; the event was previously never exercised), PAYMENT_APPLIED gains `fees_due: 700`, LOAN_CHARGED_OFF gains `fees_remaining: 600`. Story spirit unchanged: one performing loan with a full servicing cycle, one charged-off loan with a recovery.

### Amount trace (USD/2)

| # | Step | Postings | Running balances (non-zero) |
|---|---|---|---|
| 1 | LOAN_DISBURSED harper 1200000 | outstanding(ubo) -> bank | h.out -1200000; bank +1200000 |
| 2 | INTEREST_ACCRUED harper 9000 | int:recv(ubo) -> rev:interest | h.int -9000; rev.int 9000 |
| 3 | LATE_FEE_ASSESSED harper 700 | fees:recv(ubo) -> rev:lateFees | h.fees -700; rev.fees 700 |
| 4 | PAYMENT_RECEIVED 110000 | bank(ubo) -> suspense | bank +1090000; susp 110000 |
| 5 | PAYMENT_APPLIED (700/9000/25000) | susp -> {fees, interest, escrow, principal} | susp 0; h.fees 0; h.int 0; escrow 25000; h.out -1124700 |
| 6 | ESCROW_DISBURSED 22500 | escrow -> bank | escrow 2500; bank +1112500 |
| 7 | LOAN_DISBURSED quinn 300000 | outstanding(ubo) -> bank | q.out -300000; bank +1412500 |
| 8 | INTEREST_ACCRUED quinn 4500 | int:recv(ubo) -> rev:interest | q.int -4500; rev.int 13500 |
| 9 | LATE_FEE_ASSESSED quinn 600 | fees:recv(ubo) -> rev:lateFees | q.fees -600; rev.fees 1300 |
| 10 | LOAN_CHARGED_OFF quinn (300000/4500/600) | chargedOff(ubo) -> outstanding; rev:interest(ubo) -> int:recv; rev:lateFees(ubo) -> fees:recv | q.out 0; q.chargedOff -300000; q.int 0; rev.int 9000; q.fees 0; rev.fees 700 |
| 11 | RECOVERY_RECEIVED 60000 | bank(ubo) -> chargedOff | bank +1352500; q.chargedOff -240000 |

**Final invariants (live-verified):** performing book = -1124700 (BOOK_OUTSTANDING); charged-off exposure -240000; interest revenue 9000 = accrued 13500 minus reversed 4500; late-fee revenue 700 = 1300 minus 600; FEES_OUTSTANDING = 0; suspense 0; escrow +2500; bank mirror +1352500 = net cash out; ledger sums to 0. Negative balances only on receivables and chargedOff (designed).

---

## 5. remittance-fx

### Rule walk

| Rule | Verdict | Note |
|---|---|---|
| RULE-FOUNDATION-01 / HARD-01..04 | pass | Roots: external, platform, exchanges, counterparties, beneficiaries. |
| RULE-NAMING-01..10 | pass | fxDesks plural counterparty role (RULE-STRUCT-07 case 1); beneficiary payouts anchored under beneficiary (06b); pending/payable states own segments. |
| RULE-CONV-01 | pass | Per-conversion pivot `exchanges:fx:{conversion_id}`; no direct cross-asset send anywhere (AP-100 clean). |
| RULE-CONV-02 / AP-102 | **fixed** | The old sweep `send [USD/2 *]` out of the pivot hardcoded USD: any non-USD origin corridor would sweep nothing, strand the origin currency on the pivot forever (permanent non-zero residual), and never deliver the sell leg to the desk. After the restructure the pivot nets to zero in both corridor assets **by construction** (same `$collected` in and out; same `$dest_gross` in and out), independent of fixture arithmetic. Live-verified: both pivots close at 0 in USD and PHP. |
| RULE-CONV-03 / AP-101 | pass | One pivot per conversion_id; no shared pool. |
| RULE-CONV-05 | pass (info) | Family prefix is `exchanges:fx:` rather than the canonical `exchanges:conv:`; info severity, semantically identical (conversion family + per-conversion id), left as shipped to avoid churning chart, script, and gallery for a naming preference. |
| PAT-FX / RULE-NS-GRAM-10 | pass | 4-leg single-transaction variant of the 5-leg pattern: pivot holds both legs; fee carved on the pivot-to-desk leg; spread carved on the pivot-to-beneficiary leg (both destination splits already consolidated). |
| RULE-HARD-02 / RULE-ASSET-03 | pass | Each send single-asset; USD and PHP legs balance independently (verified). |
| RULE-ASSET-06 | pass | PHP/2 and USD/2 correct ISO scales in fixtures. |
| RULE-SIGN-01 / STRUCT-07/08 | pass | Desk accumulates +origin (platform owes desk) and -destination (desk delivered); DESK_SETTLED drains the origin payable to zero with no overdraft clause (it is positive by construction); rail mirrors negative on inflow. |
| RULE-OMNI-11 | pass | Payouts two-phase (pending then settled/returned); rails mirror moves only at settle. |
| RULE-NS-* / IDEM-01 / AP-030 | pass | All templates set event_type + transfer_id/conversion_id/settlement_id; PAYOUT_RETURNED sets adjustment_flag; all vars used (transfer_id rides in the payable path and metadata). |
| RULE-QUERY-* | pass | TRANSFER_TRAIL correctly uses a transactions metadata match (no address wildcards on transactions, live-confirmed constraint); `platform:rails::payouts::pending` colon count verified; all queries live-verified non-empty. |
| LEND/COLOR/GRAN-AMORT | n-a | |

### Changes

1. **FX_CONVERTED restructured (confirmed finding #2).** Old leg 1 split the fee off before the pivot and old leg 2 swept the pivot with `send [USD/2 *]`. New shape: leg 1 sends the full `$collected` into the pivot; leg 2 sends the same `$collected` out of the pivot as `{max $fee to platform:revenue:fees, remaining to counterparties:fxDesks:$desk_id}`; legs 3 and 4 unchanged (desk supplies `$dest_gross` with unbounded overdraft; pivot pays `{max $spread to fxSpread, remaining to beneficiary payable}`). No wildcard-asset sweep remains; the template is fully corridor-agnostic; the pivot's close-to-zero invariant holds for any var values (RULE-CONV-02 by construction). **Var signature unchanged (same 9 vars); fixtures unchanged; desk, revenue, and beneficiary outcomes identical to the old happy path.** Description updated.

### Amount trace (USD/2 and PHP/2)

| # | Step | Postings | Running balances (non-zero) |
|---|---|---|---|
| 1 | COLLECTION_RECEIVED tr7001 USD 20000 | ext:achus:col(ubo) -> plat:achus:col | ext.col -20000; plat.col 20000 |
| 2 | FX_CONVERTED conv01 (20000/500; PHP 1105000/11050) | col -> pivot; pivot -> {fees 500, desk 19500}; desk(ubo) -> pivot PHP; pivot -> {spread 11050, payable 1093950} | plat.col 0; pivot 0/0; fees 500; desk +19500 USD, -1105000 PHP; spread 11050; rosaph payable 1093950 |
| 3 | PAYOUT_INITIATED tr7001 1093950 | payable -> gcash pending | payable 0; pending 1093950 |
| 4 | PAYOUT_SETTLED tr7001 | pending -> ext:gcash:payouts | pending 0; ext.gcash +1093950 |
| 5 | COLLECTION_RECEIVED tr7002 USD 50000 | as step 1 | ext.col -70000; plat.col 50000 |
| 6 | FX_CONVERTED conv02 (50000/500; PHP 2775000/27750) | as step 2 | plat.col 0; pivot2 0/0; fees 1000; desk +69000 USD, -3880000 PHP; spread 38800; darioph payable 2747250 |
| 7 | PAYOUT_INITIATED tr7002 2747250 | payable -> pending | payable 0; pending 2747250 |
| 8 | PAYOUT_RETURNED tr7002 | pending -> payable (adjustment) | payable 2747250; pending 0 |
| 9 | PAYOUT_INITIATED tr7002 (retry) | payable -> pending | payable 0; pending 2747250 |
| 10 | PAYOUT_SETTLED tr7002 | pending -> ext:gcash:payouts | pending 0; ext.gcash +3841200 |
| 11 | DESK_SETTLED USD 69000 | desk -> ext:achus:payouts | desk USD 0; ext.achus.payouts +69000 |

**Final invariants (live-verified):** both pivots 0 in both assets (RULE-CONV-02); all payables and pendings 0; USD sums to 0 (`-70000 + 69000 + 1000`), net origin-rail retention 1000 = fee revenue; PHP sums to 0 (`-3880000 + 38800 + 3841200`); desk USD payable settled to 0, desk PHP -3880000 = cumulative destination currency the desk delivered (the DESK_POSITION reconciliation handle); fxSpread +38800 PHP.

---

## Validation results

- `pnpm validate` (repo root): **15 templates, 0 failure(s).**
- `numscript check` over all 37 scripts in the five templates: 0 errors.
- Live replay of all five updated fixture stories (`audit-ap2-<slug>` scratch ledgers on the demo stack): 51/51 transactions accepted; final balances equal the traces above.
- All 26 queries across the five templates executed live with fixture-consistent vars: 26/26 valid and non-empty.

## Signature / behavior changes to propagate downstream

| Template | Transaction | Change |
|---|---|---|
| marketplace-split-payments | ORDER_REFUNDED_AFTER_SPLIT | **Signature:** `$seller_share` removed; `$amount`, `$reserve_share` added (`$commission_share` kept). Behavior: single compound-source send; reserve slice now clawed back. |
| loan-servicing | PAYMENT_APPLIED | **Signature:** `monetary $fees_due` added; fees leg first in waterfall. |
| loan-servicing | LOAN_CHARGED_OFF | **Signature:** `monetary $fees_remaining` added; third send reverses late-fee revenue. |
| loan-servicing | LATE_FEE_ASSESSED | Signature unchanged; **behavior:** accrues against new `fees:receivable` instead of `interest:receivable`. |
| earned-wage-access | ADVANCE_DISBURSED | Signature unchanged; **behavior:** postings restructured (gross draw through per-advance tracker; no `[USD/2 *]` sweep). Final balances identical. |
| remittance-fx | FX_CONVERTED | Signature unchanged; **behavior:** postings restructured (fee carved on pivot-to-desk leg; no `[USD/2 *]` sweep). Final balances identical. |

Chart changes: marketplace `platform:expense:chargebacks` removed (dead node); loan-servicing `fees:receivable` added. Query changes: loan-servicing LOAN_POSITION simplified, FEES_OUTSTANDING added; digital-wallet FLOAT_COVERAGE description tightened.
