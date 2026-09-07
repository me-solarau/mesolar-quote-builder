# Entity map

Every Shelly endpoint, its Home Assistant entity ids, and the PowerShare device
it feeds. **The `endpoint_id` column is the contract** — it matches the device
ids in `src/data/site.js`, and it is what the ingest API keys on.

Rename entities in Home Assistant to this scheme *before* any billing period
starts. The recorder stores history against the entity id, so a rename after
the fact orphans the history it was billed from.

## Private endpoints

| endpoint_id | Device | Entity base | Billed to |
|---|---|---|---|
| `bed1-gpo` | Shelly 1PM Gen3 | `sensor.ps_bed1_gpo` | Bedroom Tenant 1 |
| `bed1-light` | Shelly 1PM Gen3 | `sensor.ps_bed1_light` | Bedroom Tenant 1 |
| `bed2-gpo` | Shelly 1PM Gen3 | `sensor.ps_bed2_gpo` | Bedroom Tenant 2 |
| `bed2-light` | Shelly 1PM Gen3 | `sensor.ps_bed2_light` | Bedroom Tenant 2 |
| `armand-gpo` | Shelly 1PM Gen3 | `sensor.ps_armand_gpo` | Armand |
| `armand-light` | Shelly 1PM Gen3 | `sensor.ps_armand_light` | Armand |
| `armand-ac` | Shelly 1PM Gen3 | `sensor.ps_armand_ac` | Armand |

## Communal endpoints

| endpoint_id | Device | Entity base | Notes |
|---|---|---|---|
| `computer-gpo` | Shelly 1PM Gen3 | `sensor.ps_computer_gpo` | Always-on gear; highest communal baseline |
| `computer-light` | Shelly 1PM Gen3 | `sensor.ps_computer_light` | |
| `kitchen-gpo` | Shelly 1PM Gen3 | `sensor.ps_kitchen_gpo` | Fridge base load plus appliances |
| `kitchen-light` | Shelly 1PM Gen3 | `sensor.ps_kitchen_light` | |
| `bathroom-gpo` | Shelly 1PM Gen3 | `sensor.ps_bathroom_gpo` | Heated towel rail through winter |
| `bathroom-light` | Shelly 1PM Gen3 | `sensor.ps_bathroom_light` | |
| `laundry-gpo` | Shelly 1PM Gen3 | `sensor.ps_laundry_gpo` | Washer, and dryer in cold weather |
| `laundry-light` | Shelly 1PM Gen3 | `sensor.ps_laundry_light` | |
| `shared-ac` | Shelly 1PM Gen3 | `sensor.ps_shared_ac` | 2.4 kW split system, communal area |
| `stove` | Shelly EM Gen3 + 50 A CT | `sensor.ps_stove` | **CT-metered.** The 32 A load does not pass through a relay |

## Master

| endpoint_id | Device | Entity base | Notes |
|---|---|---|---|
| `master-3em` | Shelly Pro 3EM 120 A | `sensor.ps_master` | Derived in `packages/powershare.yaml` as the sum of L1+L2+L3 |

## Not metered — and deliberately so

The main tenant's cool rooms and back-of-house circuits are **not** metered.
They are mixed through the switchboard and separating them would mean rewiring
final subcircuits, which is the cost the whole design exists to avoid.

The main tenant is therefore charged the **residual**: the master read less
every endpoint above. This is exact, not an estimate — but only while every
endpoint in the tables above is reporting. That is why an offline meter is
treated as a billing defect rather than a monitoring nuisance: its energy
silently lands here.

## Suffixes

Each entity base carries two sensors:

| Suffix | Shelly source | Used for |
|---|---|---|
| `_energy` | `total_energy` (kWh, `total_increasing`) | **Billing.** Read at period boundaries and subtracted. |
| `_power` | `power` (W, `measurement`) | Live dashboards only. Never integrated for billing. |

## Adding an endpoint later

Per the PRD's variation schedule (an extra monitored GPO, an extra lighting
point, a separately reported cool-room circuit):

1. Install and adopt the device; give it a DHCP reservation.
2. Rename its entities to a new `ps_*` base following the scheme above.
3. Add it to the `endpoints` map in `packages/powershare.yaml`.
4. Add the device in PowerShare and set its assignment.

The residual shrinks by exactly the new endpoint's usage from the moment it
starts reporting — no other figure needs adjusting, because the residual is
always defined as "everything not otherwise measured".
