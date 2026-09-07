# Hardware

The metering this app is built around. Quantities and roles come from the PRD's
base shopping list; **prices are indicative only and must be rechecked
immediately before procurement.**

## Base list

| Item | Qty | Unit | Subtotal | Purpose |
|---|---|---|---|---|
| Shelly 1PM Gen3 | 16 | $24.99 | $399.84 | 7 GPOs + 7 lights + 2 ACs |
| Shelly EM Gen3 | 1 | $96.00 | $96.00 | Stove/oven energy meter |
| Shelly 50 A CT | 1 | $22–$39 | $22–$39 | CT for the 32 A stove/oven circuit |
| Shelly Pro 3EM 120 A | 1 | $228–$269 | $228–$269 | 3-phase 50 A master / reconciliation meter |
| Home Assistant Green | 1 | $279 | $279 | Local controller and integration gateway |
| Adjacent DIN enclosure | 1 | allow $100 | $100 | If the existing board lacks space |
| Ethernet switch + patch leads | 1 | allow $60 | $60 | Wired LAN for the gateway and Pro 3EM |
| Electrical sundries | 1 | allow $150 | $150 | Protection, cable, terminals, labels, fixings |

Indicative hardware budget: **approximately $1,335–$1,385 AUD** before labour,
delivery and site variations.

## Where each meter goes

| Area | GPO | Lighting | Other |
|---|---|---|---|
| Bedroom 1 | 1PM Gen3 | 1PM Gen3 | — |
| Bedroom 2 | 1PM Gen3 | 1PM Gen3 | — |
| Armand's room | 1PM Gen3 | 1PM Gen3 | 1PM Gen3 on his private AC |
| Computer room | 1PM Gen3 | 1PM Gen3 | 1PM Gen3 on the shared AC |
| Kitchen | 1PM Gen3 | 1PM Gen3 | EM Gen3 + 50 A CT on the stove/oven |
| Bathroom | 1PM Gen3 | 1PM Gen3 | — |
| Laundry | 1PM Gen3 | 1PM Gen3 | — |
| Switchboard | — | — | Pro 3EM 120 A on L1/L2/L3 |

18 metering points, 16 of them 1PM Gen3 — matching the shopping list exactly.
The cool rooms and back-of-house are **not** metered; the main tenant is charged
the residual.

## Electrical design notes

- All 230/400 V installation work is by a **licensed electrician**, in a
  compliant enclosure.
- The 32 A stove/oven is **CT-metered**. Its load does not pass through a 16 A
  relay — the EM Gen3 measures via a CT and switches nothing.
- The two air conditioners use a 1PM Gen3 **only if** their continuous and
  inrush characteristics suit it. Verify nameplates before installation; an
  unsuitable unit becomes a CT-metering variation.
- The Pro 3EM is installed on L1/L2/L3 of the 3-phase 50 A supply and is the
  reconciliation reference for every billing period.
- Prefer wired Ethernet to the gateway, and to the Pro 3EM where practical.
- **Relay control is never exposed to any app role.** Every device is read-only
  from PowerShare. If that changes later it is a deliberate decision with its
  own permissions, not a side effect of using switching hardware as meters.

## Variations

- Additional monitored GPO: 1 × 1PM Gen3 plus installation, configuration and
  commissioning.
- Additional monitored lighting point: as above.
- AC over 16 A or with an unsuitable inrush profile: replace the 1PM allowance
  with CT-based metering.
- Additional separately reported cool-room or business circuit: add a CT
  meter/channel and the dashboard mapping. This one is worth flagging to the
  main tenant — every circuit metered this way moves energy out of their
  residual and into a line they can see.

## Wi-Fi

The single biggest risk to this design. In-wall 1PM Gen3s sit inside wall boxes
behind appliances, and a meter that drops off does not stop the load — it stops
the *attribution*, and the energy lands on the main tenant.

Survey RSSI at every meter position before the walls close up, and budget for
additional access points where it is marginal. The app makes a coverage failure
visible rather than absorbing it, but visible is not the same as free.
