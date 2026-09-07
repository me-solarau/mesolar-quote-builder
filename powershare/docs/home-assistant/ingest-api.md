# Ingest API contract

What the Home Assistant gateway posts to, and what the backend must guarantee.
The web app in this repository runs on simulated data and does not call this —
it is the contract for the production build.

## Endpoint

```
POST /v1/sites/{site_id}/readings
Authorization: Bearer <gateway token>
Idempotency-Key: <batch id>
Content-Type: application/json
```

## Request

```json
{
  "site_id": "site-1",
  "gateway": "ha-green-1",
  "batch_id": "1757212800-18",
  "readings": [
    {
      "endpoint_id": "kitchen-gpo",
      "read_at": "2026-09-07T14:05:00+10:00",
      "cumulative_kwh": 464.612,
      "power_w": 118.4,
      "available": true
    },
    {
      "endpoint_id": "shared-ac",
      "read_at": "2026-09-07T14:05:00+10:00",
      "cumulative_kwh": null,
      "power_w": null,
      "available": false
    }
  ]
}
```

`available: false` with null readings is **not** an error — it is the record
that the endpoint was unreachable at that instant, and it is what the
reconciliation code uses to work out how long a counter was frozen and how much
energy went unattributed. Dropping unavailable endpoints from the payload would
throw that information away.

## Guarantees the backend owes

- **Idempotent.** Upsert on `(site_id, endpoint_id, read_at)`. The gateway
  retries, and a duplicated batch must not duplicate energy.
- **Append-only.** A reading is never updated in place. Corrections are separate
  rows that reference the reading they correct, so the raw record survives.
- **No derived storage.** Do not store computed deltas. Deltas are derived from
  cumulative reads at query time, so a fix to the correction logic applies to
  history rather than only to the future.
- **Reject out-of-range.** A `cumulative_kwh` more than a plausible maximum
  above the previous read (say 100 kW for an hour on a 3-phase 50 A supply)
  is stored but flagged, not silently accepted.
- **Never write the meter.** This API is read-only with respect to the devices.
  There is no relay endpoint, by design.

## Counter resets

A cumulative counter that goes backwards means the meter reset — usually a
firmware update or a power cycle. The backend stores the raw reading as it
arrived; the allocation engine handles the discontinuity when it computes the
period delta (`deviceDelta()` in `src/lib/allocation.js`), by summing only the
forward movements of the counter and recording the correction.

Do not "fix" the reading on ingest. The raw series is the evidence.

## Auth

One bearer token per gateway, scoped to one site, write-only to the readings
endpoint. It cannot read tenant data, cannot issue statements, and cannot be
used from a browser. Rotate it at commissioning and whenever an installer
leaves the engagement.
