# Home Assistant gateway

The data path in the PRD is:

```
Shelly meters → site LAN → Home Assistant Green → ingest API → database → PowerShare
```

Home Assistant Green is the local gateway. It talks to the Shelly devices over
the LAN using the native Shelly integration, and it is the only thing that ever
touches them — PowerShare itself has no device credentials and no relay control.

This directory holds the configuration for the gateway half of that path. The
web app in this repository runs on simulated telemetry, so nothing here is
required to explore the app; it is what you deploy when you wire the real site
up.

## Files

| File | What it does |
|---|---|
| `configuration.yaml` | The lines to add to Home Assistant's main config. |
| `packages/powershare.yaml` | Entity naming, the utility-meter helpers, and the REST push to the ingest API. |
| `entity-map.md` | Which Shelly device is which endpoint, and what each maps to in PowerShare. |
| `mqtt-bridge.md` | The MQTT alternative to the REST push, for higher-frequency telemetry. |
| `ingest-api.md` | The contract the gateway posts to — request shape, idempotency, auth. |

## Order of work on site

1. **Commission the hardware.** Licensed electrician; Pro 3EM on L1/L2/L3 of the
   3-phase 50 A supply, EM Gen3 + 50 A CT on the 32 A stove circuit, 1PM Gen3 on
   each monitored GPO, light and (nameplate permitting) air conditioner.
2. **Fix the addresses.** Give every Shelly a DHCP reservation before you name
   anything. Entity ids that follow an address are worthless when the address
   changes.
3. **Adopt the devices in Home Assistant.** The Shelly integration
   auto-discovers over mDNS. Do not enable cloud or MQTT on the devices
   themselves — keep them local-only.
4. **Rename every entity** to the scheme in `entity-map.md` *before* creating any
   statistics, because the recorder keys history off the entity id.
5. **Add the package** in `packages/powershare.yaml` and restart.
6. **Verify** for at least 48 hours: the sum of the submeters plus the unmetered
   residual should track the Pro 3EM within a couple of percent. The installer
   screen in the app is built for exactly this check.
7. **Point the REST push at the ingest API** and confirm rows are landing.

## Why cumulative energy, not power

Every entity PowerShare ingests is a **cumulative kWh total** (Shelly's
`total_energy`), never instantaneous watts. Billing reads the counter at the
period boundaries and subtracts. Integrating a power sensor over a month
compounds every sampling gap into a billing error, and the errors are invisible
— which is exactly the failure the PRD says must not happen.

Instantaneous power is still ingested, but only to drive the live dashboards.

## Wi-Fi is the thing that will bite you

In-wall 1PM Gen3s sit inside metal-adjacent wall boxes behind appliances. Survey
the RSSI at each position before the plasterer closes the wall up, and add
access points where it is marginal. A meter that drops off for a week does not
lose its own count — the device keeps totalising locally and Home Assistant
picks the total back up on reconnect — but a meter that loses **power** does,
and either way the app flags the gap rather than absorbing it.
