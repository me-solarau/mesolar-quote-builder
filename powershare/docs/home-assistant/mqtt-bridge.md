# MQTT bridge (alternative transport)

The REST push in `packages/powershare.yaml` is the default: it is one
automation, it batches, and it fails loudly. Use MQTT instead when you want
sub-minute telemetry, or when the gateway's internet link is unreliable enough
that a queue with persistence matters more than simplicity.

Note the trade: MQTT gives you an event stream, but billing still reads
cumulative counters at period boundaries. Higher frequency improves the live
dashboards and the outage detection — it does not make the bill more accurate.

## Devices stay local

Do **not** enable the Shelly devices' own MQTT client. Keeping them on the
native Home Assistant integration means one adoption path, one firmware update
path, and no device holding broker credentials. Home Assistant publishes to the
broker on their behalf.

## Broker

Mosquitto on the Home Assistant Green, TLS, one account for the gateway
publisher and one read-only account for the backend subscriber.

```yaml
# mosquitto.conf
listener 8883
certfile /ssl/fullchain.pem
keyfile  /ssl/privkey.pem
allow_anonymous false
password_file /share/mosquitto/accounts
persistence true
persistence_location /data/
# Buffer while the backend is away; sized for ~24 h of 1-minute telemetry.
max_queued_messages 200000
```

## Topics

```
powershare/site-1/endpoint/<endpoint_id>/energy    retained, QoS 1
powershare/site-1/endpoint/<endpoint_id>/power     not retained, QoS 0
powershare/site-1/endpoint/<endpoint_id>/status    retained, QoS 1  ("online" | "offline")
powershare/site-1/gateway/status                   retained, QoS 1, LWT "offline"
```

Energy is retained so a subscriber that reconnects immediately learns the
current counter. Power is not — a stale wattage is worse than none.

The gateway's last-will on `gateway/status` is what tells the backend the
difference between "every endpoint went quiet" and "the gateway went quiet".
They need different responses, and conflating them is how an outage gets
misdiagnosed.

## Publishing from Home Assistant

```yaml
automation:
  - id: powershare_mqtt_publish
    alias: PowerShare — publish to MQTT
    mode: queued
    max: 40
    trigger:
      - platform: state
        entity_id:
          - sensor.ps_kitchen_gpo_energy
          - sensor.ps_shared_ac_energy
          # …one line per endpoint; keep in step with entity-map.md
    action:
      - service: mqtt.publish
        data:
          topic: >
            powershare/site-1/endpoint/{{
              trigger.entity_id | replace('sensor.ps_', '') | replace('_energy', '') | replace('_', '-')
            }}/energy
          retain: true
          qos: 1
          payload: >
            {{ {'cumulative_kwh': trigger.to_state.state,
                'read_at': trigger.to_state.last_updated.isoformat(),
                'available': trigger.to_state.state not in ['unknown', 'unavailable']} | tojson }}
```

## Backend subscriber

Subscribe with a persistent session (`clean_session: false`) and a stable client
id, so messages published while the backend is restarting are delivered on
reconnect rather than lost. Write straight into the same readings table the REST
path uses — the two transports must not produce different rows, or the audit
trail stops meaning anything.
