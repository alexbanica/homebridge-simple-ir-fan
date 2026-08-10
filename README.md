# homebridge-simple-ir-fan

A Homebridge dynamic platform plugin that exposes configurable HTTP-controlled fans and per-fan Device Integration API reset triggers.

## Features

- One HomeKit `Fanv2` accessory for each configured fan device.
- Power, speed, and oscillation controls backed by configurable HTTP endpoints.
- Status refresh from each device's configured `getStatus` endpoint.
- One stable HomeKit `Switch` service per fan (where configured) for resetting Device Integration API application state.
- Cached accessory restoration and removal of devices no longer present in configuration.

## Requirements

- A Homebridge-supported Node.js version.
- Homebridge 1.8 or later, or a supported Homebridge 2 beta.
- Network reachability from Homebridge to the configured fan endpoints and Device Integration API.

## Installation

Install dependencies and build the plugin:

```shell
npm install
npm run build
```

For local Homebridge development, link the package with `npm link` and use `npm run watch`.

## Configuration

The public identifiers are:

- Plugin: `homebridge-simple-ir-fan`
- Platform: `SimpleIrFan`

See [`config.schema.json`](./config.schema.json) for the Homebridge UI contract and [`config.example.json`](./config.example.json) for a complete example.

```json
{
  "platform": "SimpleIrFan",
  "name": "SimpleIrFan",
  "devices": [
    {
      "name": "Living Room Fan",
      "manufacturer": "Generic",
      "model": "IR Fan",
      "serialNumber": "FAN-001",
      "timeoutMs": 5000,
      "endpoints": {
        "start": { "uri": "http://fan-api/api/ventilator/start", "method": "POST" },
        "stop": { "uri": "http://fan-api/api/ventilator/stop", "method": "POST" },
        "setSpeed": { "uri": "http://fan-api/api/ventilator/speed/${speed}", "method": "PUT" },
        "startRotation": { "uri": "http://fan-api/api/ventilator/rotate", "method": "POST" },
        "stopRotation": { "uri": "http://fan-api/api/ventilator/rotate", "method": "POST" },
        "reset": { "uri": "http://fan-api/api/v1/fan/reset", "method": "POST" },
        "getStatus": { "uri": "http://fan-api/api/ventilator/state", "method": "GET" }
      }
    }
  ]
}
```

Each device supports optional authentication headers or a bearer token through its `auth` configuration. Fan endpoint behavior remains independent of the reset trigger.

### Reset configuration migration

`apiBaseUrl` is no longer used.

- Remove top-level `apiBaseUrl` from your config.
- Add optional `reset` under each fan’s `endpoints` object as `devices[].endpoints.reset`.
- The new per-fan `reset` configuration replaces the previous platform-level reset accessory behavior.

## Reset switch behavior

The platform exposes one stable momentary `Switch` service on the fan’s own accessory:

- An ON write sends exactly one bodyless `POST` to the configured `endpoints.reset.uri`.
- Only HTTP `202 Accepted` is considered successful.
- The request times out after the fan’s configured `timeoutMs`, defaulting to `5000`.
- No automatic retries are performed.
- OFF writes do not contact the API.
- The switch reports `ON` while the request is pending and returns to `OFF` after success or failure.
- Failures are logged and surfaced to HomeKit as `SERVICE_COMMUNICATION_FAILURE` without escaping the plugin boundary.
- Concurrent ON writes on the same fan reuse one in-flight request.
- ON writes on different fans are independent.

The reset endpoint must match the full URI with method `POST` and path `/api/v1/fan/reset`.
It must use `http://` or `https://`, and it must not include a query string, fragment, or embedded credentials.

Fan-level authentication configured on `devices[].auth` is not applied to reset requests. Reset calls are unauthenticated.

If configured, the reset endpoint applies only to API application state (`isOn=false`, `speed=0`, `isRotating=false`) and does not issue any IR command or read physical fan state.

When valid reset configuration is removed, no reset switch is exposed for that fan.

## Validation

```shell
npm test
npm run lint
npm run build
npm run prepublishOnly
```

Runtime validation requires starting Homebridge with the intended configuration, activating the reset Switch in Home, and confirming it returns to OFF after the API request settles.

## License

Apache-2.0
