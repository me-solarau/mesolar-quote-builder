# PowerShare

Tenant energy consumption allocation platform — splits one shared electricity
bill fairly between the people who actually used it, using measured
consumption rather than a guess.

Built from `tenant_energy_app_prd.docx` (PRD v1.0, 7 September 2026). The site
it models is the one in the PRD: four cost participants, seven monitored areas,
two air conditioners, a CT-metered 32 A stove and a 3-phase 50 A master meter.

```
npm install
npm run dev      # http://localhost:5173
npm test         # allocation engine + permission tests
npm run lint     # no-undef and rules-of-hooks — the build does not catch either
npm run build
```

## What this build is

A complete, working front end on **simulated meter telemetry**. There is no
backend: the 18 meters are generated deterministically in the browser, and
owner-entered records (bills, assignments, split rules, statements, overrides,
the audit trail) persist to `localStorage`.

Everything the allocation depends on — the engine, the reconciliation checks,
the data-quality handling, the statement snapshots — is real code that would
move to the server unchanged. What is stubbed is the transport, not the logic.

The gateway half of the production data path is written up and ready to deploy
in `docs/home-assistant/`.

## Sign in

The login screen is a role switcher. No passwords.

| Account | Sees |
|---|---|
| Property Owner | Everything: dashboard, tenants, devices, billing, reports, settings |
| Bedroom Tenant 1 / 2, Armand, Main Tenant | Their own usage, their communal share, their statements |
| Installer | Commissioning, live verification, device health |

Armand is the most interesting tenant (he has a private air conditioner); the
Main Tenant shows the residual case, where usage is calculated rather than
metered.

## The core rule

```
Main Tenant Direct kWh = master 3-phase kWh
                       − Bedroom 1 − Bedroom 2 − Armand − Communal

Allocated Tenant kWh   = Direct kWh + share of Communal
Allocated Cost         = Allocated kWh ÷ Master kWh × Distributable Amount
```

Communal is split by a configurable rule; the base assumption is 25% each.
Because assigned energy is subtracted before the residual is computed, no
device can ever be billed twice. Full detail in
[`docs/ALLOCATION.md`](docs/ALLOCATION.md).

## What the seeded site is doing right now

The demo opens on a live period with four real data-quality situations, because
an allocation tool that has only ever seen clean data has not been tested:

| Endpoint | What happened | Consequence |
|---|---|---|
| Shared Air Conditioner | Offline 5 days | ~39 kWh unattributed — **blocks statement issue** |
| Bathroom GPO | Offline 7 hours | Flagged; too small to block |
| Laundry Lighting | Counter reset on 21 Aug | Raw delta −77.5 kWh; billed 7.1 kWh after correction |
| Computer Room GPO | 19 h reporting gap | Counter caught up on reconnect — no energy lost |

The blocked state is the point. The owner can release it, but only by recording
a written reason, which then appears in the audit trail and on every statement
for that period.

## Layout

```
src/
  data/       site model (18 devices), telemetry simulator, seed records
  lib/        allocation engine + tests, alerts, statements, views, store, palette
  components/ charts (hand-rolled SVG), UI primitives, statement document
  screens/    tenant · owner · installer · auth
docs/
  ALLOCATION.md      how the numbers are produced, and why
  HARDWARE.md        the shopping list and the electrical notes
  home-assistant/    gateway config, entity map, ingest contract, MQTT bridge
```

No UI framework beyond React, no chart library, no router — the charts are SVG
written against the data-viz palette, validated for colour-vision deficiency in
both light and dark themes.

## Requirements coverage

All twelve functional requirements, both screen sets and every MVP acceptance
criterion in section 8 are implemented. Four are worth stating precisely,
because "implemented" means something narrower than it might sound:

- **FR-01 device onboarding.** Adding a meter registers the endpoint, its
  location, load type and assignment, and logs it to the audit trail. It then
  shows as *awaiting first reading* and contributes nothing to any allocation
  until cumulative energy arrives — which is how a real commissioning behaves,
  and means onboarding mid-period cannot disturb a bill. **Network discovery is
  not implemented**; that lives in Home Assistant.
- **FR-02 live monitoring.** Power, voltage, current, per-phase loading, phase
  imbalance and headroom against each meter's rating. Voltage is measured per
  phase by the Pro 3EM and inherited by the 1PM endpoints on that phase — a
  relay meter measures its own circuit, not the supply, so that is what the real
  integration would report too.
- **FR-03 energy history.** Today, 7 days, billing period and a custom range,
  on the tenant Usage screen and the owner dashboard chart. Billing itself is
  never re-scoped: a statement always covers exactly one billing period.
- **Acceptance criterion 7 (tenant isolation).** `visibleTo()` in
  `src/lib/views.js` is the projection, and routing is guarded by role, so no
  tenant screen or URL reaches another participant's figures. But this build has
  no backend and no authentication — every participant's numbers are computed in
  the browser, so the isolation is a UI contract, not a security boundary. In
  production the same shape is a row-level-security policy and the client never
  receives the other rows at all.

Deliberately left short of the PRD's ambition: cost treatment. The MVP shares a
single distributable amount, and splitting usage charges, daily supply charges,
demand charges and solar credits into separate allocation rules is left to a
later version, as the PRD itself proposes. The data model already carries the
invoice total, the supply charge and the distributable amount separately.

## Taking it to production

The PRD's recommended stack is Home Assistant Green → ingest API → Postgres →
PWA. The pieces to build:

1. **Ingest API** to the contract in `docs/home-assistant/ingest-api.md`.
2. **Postgres schema** mirroring the objects in `src/lib/store.js` — sites,
   participants, devices, assignments, readings, billing periods, retailer
   bills, split rules, statements, audit events.
3. **Row-level security** matching `visibleTo()` in `src/lib/views.js`. A tenant
   must never be able to read another tenant's rows, and the client must not be
   what enforces it.
4. **Auth** — email plus magic link, roles as in the table above.
5. Swap the telemetry source in `src/lib/useApp.jsx` from `buildTelemetry()` to
   the API. Nothing downstream of it changes.
