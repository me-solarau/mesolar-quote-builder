# How the allocation works

The engine is `src/lib/allocation.js`. It is pure: same telemetry, same period,
same rules → same numbers, every time. That is what makes a statement something
a tenant can check rather than something they have to accept.

## The sequence

Straight from the PRD, section 5:

1. Read the master 3-phase kWh for the exact bill period.
2. Read every explicit tenant and communal meter delta for the same period.
3. **Main Tenant Direct kWh = master − every explicitly assigned endpoint.**
4. Communal kWh = the sum of its assigned endpoints.
5. Split communal kWh by the configured weights (base: 25% each).
6. Allocated Tenant kWh = Direct kWh + Communal Share kWh.
7. Allocated Cost = Allocated kWh ÷ Master kWh × Distributable Bill Amount.
8. Check the result reconciles back to the retailer totals.

Steps 3 and 6 together are why the residual can never double-count: energy
assigned to a participant is subtracted *before* the residual is computed, so it
cannot appear on two bills. There is a test for exactly this
(`allocation.test.js` → "the residual never double-counts an explicitly assigned
device").

## Cumulative energy, not integrated power

Every figure that reaches a bill comes from a cumulative kWh counter read at the
period boundaries. Instantaneous watts drive the live views and nothing else.

Integrating a power sensor across a month turns every sampling gap into a
billing error, and those errors are invisible — the number still looks
plausible. Subtracting two counter reads is either right, or obviously wrong.

## Counter resets

Cumulative counters go backwards sometimes: firmware updates, power cycles,
factory resets. The raw end-minus-start delta is then negative and useless.

`deviceDelta()` walks the series instead and sums only the forward movements,
treating a backwards step as a reset and counting the post-reset reading as
energy accrued since. Every correction is returned, shown on the device row, and
printed on the statement. The raw reading is never edited.

The seeded data includes a real instance of this: Laundry Lighting reset on
21 August. Its raw period delta is **−77.5 kWh**; its billed figure is
**7.1 kWh**. Both numbers are on the period report, side by side.

## Two different reconciliation questions

They get confused constantly, so the app keeps them apart.

**"Do the parts add up to the whole?"** Always yes, by construction — the
residual absorbs whatever is left. `kwhReconciliationError` is therefore always
~0, and a non-zero value means a bug, not a site problem. It is reported anyway,
because a check that can only ever pass is worth having when it fails.

**"Is the split telling the truth?"** This is the one that matters, and it has
two tests:

- *Residual band.* The main tenant's residual should sit inside a configured
  range (15–55% of master here). Above it, something that should be metered
  probably is not, or a meter is offline. Below it, a device may be assigned to
  the wrong participant.
- *Energy at risk.* When a meter's counter freezes, energy keeps flowing through
  the master and lands in the residual. `energyAtRisk()` estimates it from the
  device's own recent history. Above the site threshold (1.5% — the PRD asks
  for monthly reconciliation within 1–2%), statement issue is **blocked**.

A gap the meter rode out locally — no samples reached the gateway, but the
counter kept running and caught up on reconnect — costs nothing and is reported
as information, not a fault. The app distinguishes the two cases rather than
lumping every gap together, because only one of them moves money.

## The override

A blocked period can be released, but only by recording a written reason. The
reason goes into the audit trail and is printed on every statement issued for
that period. There is no way to clear the block quietly.

This is the PRD's MVP acceptance criterion — "prevents final statement
generation if meter data is materially incomplete unless owner explicitly
overrides with a reason" — and it is the single most important behaviour in the
app. Everything else is arithmetic; this is the part that keeps the arithmetic
honest.

## Statements are frozen

Issuing a statement stores a **snapshot** of every figure (`src/lib/statement.js`).
Changing a split rule or a device assignment afterwards recalculates the live
view and leaves issued statements alone.

Without this, an assignment fixed in October would silently restate a bill paid
in July, and the audit trail would record a change to numbers nobody could
reproduce.

## Cost, and what is actually shared

Cost allocation is deliberately simple for the MVP: one distributable amount,
split by share of measured energy. The owner decides what goes into it — in the
seeded data, the invoice total less the daily supply charge the owner absorbs.

The PRD flags splitting usage charges, supply charges, demand charges and solar
credits into separate allocation rules as a later version. The data model is
ready for it — a bill already carries `retailerTotal`, `supplyCharge` and
`distributableAmount` separately — but the rules engine is not built, and
pretending otherwise would put a number on a statement that nobody could derive.
