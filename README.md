# homebridge-simple-ir-fan

A Homebridge dynamic platform plugin that exposes configurable HTTP-controlled fans and one momentary Device Integration API reset trigger.

## Features

- One HomeKit `Fanv2` accessory for each configured fan device.
- Power, speed, and oscillation controls backed by configurable HTTP endpoints.
- Status refresh from each device's configured `getStatus` endpoint.
- One stable HomeKit `Switch` accessory for resetting Device Integration API application state.
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
  "apiBaseUrl": "http://localhost:3000",
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
        "getStatus": { "uri": "http://fan-api/api/ventilator/state", "method": "GET" }
      }
    }
  ]
}
```

Each device supports optional authentication headers or a bearer token through its `auth` configuration. Fan endpoint behavior remains independent of the reset trigger.

### Reset API base URL

`apiBaseUrl` is optional and defaults to `http://localhost:3000`.

It must be an absolute HTTP or HTTPS origin. A trailing slash is allowed; paths, query strings, fragments, and embedded credentials are rejected. Invalid supplied values disable only the reset accessory and are logged without exposing the configured URL.

## Reset switch behavior

The platform exposes one stable momentary Switch named from the platform `name`:

- An ON write sends exactly one bodyless `POST <apiBaseUrl>/api/v1/fan/reset`.
- Only HTTP `202 Accepted` is successful.
- The request times out after five seconds and is never retried automatically.
- Concurrent ON writes share one in-flight request.
- OFF writes do not contact the API.
- The Switch reports ON while the request is pending and returns to OFF after success or failure.
- Failures are logged and surfaced to HomeKit as `SERVICE_COMMUNICATION_FAILURE` without escaping the plugin boundary.

Reset changes the API's persisted application state to `isOn=false`, `speed=0`, and `isRotating=false`. It does not issue an IR command, query the physical fan, or guarantee that the physical fan is off.

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
