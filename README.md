# homebridge-simple-ir-fan

A Homebridge dynamic platform plugin that exposes configurable HTTP-controlled fans and per-fan Device Integration API reset triggers.

## Features

- One HomeKit `Fanv2` accessory for each configured fan device.
- Power, speed, and oscillation controls backed by configurable HTTP endpoints.
- Status refresh from each device's configured `getStatus` endpoint.
- One stable HomeKit `Switch` service per fan (where configured) for resetting Device Integration API application state.
- One stable HomeKit `Switch` service per fan (where configured) for toggling physical fan rotation.
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

## Release publishing

Releases use exact tags in the form `MAJOR.MINOR.PATCH` for stable versions or
`MAJOR.MINOR.PATCH-betaN` for beta versions. The Git tag is also the published
npm package version. Stable releases use the npm `latest` dist-tag; beta
releases use the `beta` dist-tag.

Use the release command from a tagged checkout:

```shell
RELEASE_TAG=1.2.3 NODE_AUTH_TOKEN=<forgejo-package-token> npm run publish:forgejo
```

That command publishes `@alexlab/homebridge-simple-ir-fan` to the fixed Forgejo registry
at `https://forgejo.alexlab.nl/api/packages/public/npm/`.

Release publishing requires both environment variables:

- `RELEASE_TAG`: the exact tag to release, in `MAJOR.MINOR.PATCH` or
  `MAJOR.MINOR.PATCH-betaN` form.
- `NODE_AUTH_TOKEN`: the Forgejo package token used only for the publish step.

The package is readable from the public registry, but writing requires an
authorized maintainer or service account that is a member of the Forgejo
`public` organization and has `write:package` access with the `Public only`
restriction.

Store that token in GitHub as the Actions secret `FORGEJO_PACKAGE_TOKEN`.
The GitHub release workflow should accept only trusted pushed numeric release tags, and
the repository should use a tag ruleset or equivalent policy so only trusted
maintainers can create or update those tags.

The Forgejo server must present the full trusted TLS certificate chain. Do not
use `curl -k`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, `npm config set strict-ssl
false`, or any equivalent bypass.

Publishing the same package name and version twice is immutable: a duplicate
publish must fail instead of overwriting the existing version.

The GitHub release workflow uses the hosted `ubuntu-slim` runner. It provides
a minimal preinstalled tool set, does not require Docker or privileged
operations for this publish job, and enforces a 15-minute job limit.
`ubuntu-slim` still needs normal DNS and outbound TCP 443 access to Forgejo
and npm dependency sources. A self-hosted runner needs the same connectivity.

The first tag creation, first publish, and first install or verification of the
published package are operator-owned actions. Until that round trip succeeds,
release documentation and release workflow behavior should be treated as DRAFT.

Exact-version install example:

```shell
npm install @alexlab/homebridge-simple-ir-fan@1.2.3 --registry https://forgejo.alexlab.nl/api/packages/public/npm/
```

Beta install example:

```shell
npm install @alexlab/homebridge-simple-ir-fan@beta --registry https://forgejo.alexlab.nl/api/packages/public/npm/
```

## Configuration

The public identifiers are:

- Plugin: `@alexlab/homebridge-simple-ir-fan`
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
        "rotate": { "uri": "http://fan-api/api/v1/fan/rotate", "method": "POST" },
        "reset": { "uri": "http://fan-api/api/v1/fan/reset", "method": "POST" },
        "getStatus": { "uri": "http://fan-api/api/ventilator/state", "method": "GET" }
      }
    }
  ]
}
```

Each device supports optional authentication headers or a bearer token through its `auth` configuration. Fan endpoint behavior remains independent of the reset and rotation toggles. Coalescing is per fan and per action: concurrent reset writes on one fan share a request, concurrent rotation writes on one fan share a request, and reset plus rotation on the same fan remain independent.

### Reset configuration migration

`apiBaseUrl` is no longer used.

- Remove top-level `apiBaseUrl` from your config.
- Add optional `reset` under each fan’s `endpoints` object as `devices[].endpoints.reset`.
- The new per-fan `reset` configuration replaces the previous platform-level reset accessory behavior.

### Rotation configuration migration

- Replace `devices[].endpoints.startRotation` and `devices[].endpoints.stopRotation` with a single `devices[].endpoints.rotate` entry.
- Remove any HomeKit `SwingMode` expectations from the fan accessory. Rotation is now exposed as a momentary `Switch`, not as a stateful HomeKit swing control.
- Add `rotate` under the same `devices[].endpoints` object as `reset`, not at the platform root or inside another nested object.

## Reset switch behavior

The platform exposes one stable momentary `Switch` service on the fan’s own accessory:

- An ON write sends exactly one bodyless `POST` to the configured `endpoints.reset.uri`.
- Only HTTP `202 Accepted` is considered successful.
- The request times out after the fan’s configured `timeoutMs`, defaulting to `5000`.
- No automatic retries are performed.
- OFF writes do not contact the API.
- The switch reports `ON` while the request is pending and returns to `OFF` after success or failure.
- Failures are logged and surfaced to HomeKit as `SERVICE_COMMUNICATION_FAILURE` without escaping the plugin boundary.
- Concurrent ON writes on the same fan for reset reuse one in-flight request.
- ON writes on different fans are independent.

The reset endpoint must match the full URI with method `POST` and path `/api/v1/fan/reset`.
It must use `http://` or `https://`, and it must not include a query string, fragment, or embedded credentials.

Fan-level authentication configured on `devices[].auth` is not applied to reset requests. Reset calls are unauthenticated.

If configured, the reset endpoint applies only to API application state (`isOn=false`, `speed=0`, `isRotating=false`) and does not issue any IR command or read physical fan state.

When valid reset configuration is removed, no reset switch is exposed for that fan.

## Rotation toggle behavior

The platform exposes one stable momentary `Switch` service on the fan’s own accessory:

- An ON write sends exactly one bodyless `POST` to the configured `devices[].endpoints.rotate.uri`.
- Only HTTP `202 Accepted` is considered successful.
- The request times out after the fan’s configured `timeoutMs`, defaulting to `5000`.
- No automatic retries are performed.
- OFF writes do not contact the API.
- The switch reports `ON` while the request is pending and returns to `OFF` after success or failure.
- Failures are logged and surfaced to HomeKit as `SERVICE_COMMUNICATION_FAILURE` without escaping the plugin boundary.
- Concurrent ON writes on the same fan for rotation reuse one in-flight request.
- ON writes on different fans are independent.

The rotation endpoint must match the full URI with method `POST` and path `/api/v1/fan/rotate`.
It must use `http://` or `https://`, and it must not include a query string, fragment, or embedded credentials.

Fan-level authentication configured on `devices[].auth` is not applied to rotation requests. Rotation calls are unauthenticated.

If configured, the rotation endpoint means only that the Device Integration API accepted the toggle command. It does not claim the fan is now rotating, does not publish `isRotating`, and does not guarantee the final physical fan state.

When valid rotation configuration is removed, no rotation toggle switch is exposed for that fan.

## Validation

```shell
npm test
npm run lint
npm run build
npm run prepublishOnly
```

Runtime validation requires starting Homebridge with the intended configuration, activating the reset or rotation Switch in Home, and confirming it returns to OFF after the API request settles.

## License

Apache-2.0
