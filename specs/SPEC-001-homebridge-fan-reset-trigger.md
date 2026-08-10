# SPEC-001 - Homebridge Fan Reset Trigger

Status: Approved
Date: 2026-08-10

## Iteration: Optional Per-Fan Reset Control

This iteration supersedes the previously approved platform-level reset
accessory design.

Delta from the previous behavior:

- Move reset configuration from top-level `apiBaseUrl` to optional
  `devices[].endpoints.reset`.
- Expose reset as a secondary momentary Switch service on the same HomeKit
  accessory as the configured fan.
- Do not create or retain a separate reset accessory.
- Preserve all existing Fanv2 power, speed, oscillation, status, authentication,
  device identity, and cache behavior except where reset-service reconciliation
  is explicitly described below.

## Purpose

Allow each configured fan to opt into the Device Integration API reset action
without creating a separate HomeKit accessory.

## Problem

The current reset implementation creates one platform-level reset accessory and
uses a global API base URL. A reset is conceptually an action for a configured
fan, so its endpoint and HomeKit control should belong to that fan. Users who do
not configure a reset endpoint should see no reset control.

## Scope

In scope:

- Add optional `reset` configuration to each fan's existing `endpoints` object.
- Represent reset with a momentary HomeKit Switch service attached to the same
  `PlatformAccessory` as that fan's Fanv2 service.
- Invoke the configured reset URI as a bodyless `POST`.
- Treat only HTTP `202 Accepted` as success.
- Keep reset behavior deterministic across success, failure, repeated writes,
  Homebridge restarts, and cached fan-accessory restoration.
- Remove the top-level `apiBaseUrl` configuration and platform-level reset
  accessory behavior.
- Remove a cached platform-level reset accessory through normal platform
  reconciliation.
- Add or remove the per-fan reset Switch service when a restored fan's reset
  configuration is added or removed.
- Preserve all existing configured fan controls and endpoint behavior.

Out of scope:

- Changing existing fan start, stop, speed, rotation, or status behavior.
- Querying fan status or changing Fanv2 characteristic state after reset.
- Changing the Device Integration API, OpenAPI contract, or persistence
  behavior.
- Adding reset authentication, request headers, request bodies, query
  parameters, retries, telemetry, command history, or audit events.
- Providing a guarantee that the physical fan is OFF after reset. Reset changes
  and persists Device Integration API application state only.
- Providing a native HomeKit push-button service. HomeKit exposes no native
  button service for this use case, so a momentary Switch is used.

## Definitions

- **Configured fan:** One entry in the platform's `devices` array.
- **Reset endpoint:** Optional `devices[].endpoints.reset` configuration with an
  absolute URI and method fixed to `POST`.
- **Reset Switch:** A secondary HomeKit Switch service on the configured fan's
  existing accessory. It is OFF while idle, ON while its request is pending,
  and OFF again when the request settles.
- **Reset in progress:** The interval from accepting an idle-to-ON reset write
  until its HTTP request succeeds, fails, or times out.
- **Idle:** No reset request is in progress for that configured fan.

## Inputs And Constraints

- `devices[].endpoints.reset` is optional.
- When omitted, that fan exposes no reset Switch and makes no reset request.
- When present, `reset` contains:
  - `uri`: an absolute `http://` or `https://` URI whose path is exactly
    `/api/v1/fan/reset`;
  - `method`: exactly `POST`.
- The reset URI must not contain a query string, fragment, or embedded
  credentials.
- Reset configuration accepts no body template, headers, query parameters, or
  authentication fields. Existing device authentication is not applied to the
  reset request because the reset API contract is unauthenticated.
- The reset request has no body.
- Reset uses the configured fan's `timeoutMs`, defaulting to five seconds when
  omitted.
- Reset requests are not retried automatically.
- Each configured fan has an independent reset service and in-flight request.
- Concurrent reset writes for the same fan share one in-flight request.
- Reset requests for different configured fans do not coalesce with one another.
- The fan accessory UUID remains generated from its existing
  `serialNumber:name` identity; adding, removing, or changing the reset endpoint
  does not change accessory identity.
- The reset Switch service uses a stable subtype within the fan accessory so
  cached restoration does not create duplicate services.
- Homebridge, HomeKit, HTTP, logging, filesystem, and runtime concerns remain
  outside domain and application contracts in accordance with the repository's
  onion-architecture dependency direction.

## Deterministic Behavior

### 1. Platform startup and reconciliation

- The platform creates and restores configured fan accessories exactly as it
  does today.
- A fan with a valid reset endpoint has one Fanv2 service and one reset Switch
  service on the same HomeKit accessory.
- A fan without a reset endpoint has its existing Fanv2 service and no reset
  Switch.
- No platform-level reset accessory is registered.
- A cached platform-level reset accessory from the superseded design is removed
  because its UUID is not part of the configured fan UUID set.
- On restoration, a newly configured reset endpoint adds the reset Switch to the
  existing fan accessory without changing its UUID.
- On restoration, removing reset configuration removes the cached reset Switch
  from that fan accessory without removing the Fanv2 service.
- If a supplied per-fan reset endpoint is invalid, the plugin logs a concise
  device-specific configuration error without secrets, exposes no usable reset
  Switch for that fan, and preserves the fan's other services and controls.
- Configuration errors and service reconciliation errors are contained within
  the plugin boundary.

### 2. Idle reset activation

- When HomeKit writes ON to an idle fan's reset Switch, that fan starts exactly
  one reset request and the Switch reports ON while it is pending.
- The request is a bodyless `POST` to the configured reset URI.
- A `202 Accepted` response completes the action successfully. The response body
  is not parsed and does not affect the result.
- After success, the reset Switch returns to OFF and Homebridge logs the fan's
  successful reset at informational level.
- Reset success does not change, query, or publish Fanv2 power, speed, or
  oscillation characteristics.

### 3. OFF writes and concurrent activation

- An OFF write never invokes the reset endpoint and leaves the reset Switch OFF
  when idle.
- A second ON write for the same fan while reset is in progress sends no second
  request and observes the shared in-flight result.
- After settlement returns the Switch to OFF, a later ON write sends a new
  request.
- Concurrent ON writes on different fan accessories send one request per fan.

### 4. Failure handling

- A timeout, network error, invalid runtime reset configuration, or any HTTP
  status other than `202` is a failed reset.
- On request failure, the reset Switch returns to OFF, Homebridge logs a concise
  error identifying the configured fan without logging secrets, and HomeKit
  reports `SERVICE_COMMUNICATION_FAILURE` for the reset write.
- A failed reset is not retried and does not prevent that fan from accepting a
  later deliberate reset.
- Reset failure does not disable or change the fan's existing Fanv2 controls.
- All asynchronous failures are caught within the plugin boundary; none may
  become an unhandled rejection or terminate Homebridge.

### 5. API action meaning

- Successful reset means the Device Integration API accepted and persisted its
  default OFF application state: `isOn=false`, `speed=0`, and
  `isRotating=false`.
- The reset Switch does not claim the API issued an IR command or reconciled the
  physical fan.

## Assumptions

- Homebridge can reach each configured reset URI from its runtime network.
- The Device Integration API OpenAPI contract remains authoritative for the
  reset path, method, lack of body, authentication, and response statuses.
- A secondary momentary Switch on the existing fan accessory is the intended
  HomeKit affordance. Home may render services as tiles, but reset remains part
  of the same accessory and does not get a separate accessory UUID.
- Existing configured-fan endpoint behavior on `origin/latest` remains the
  regression baseline.

## Regression And Compatibility Impact

- Removing top-level `apiBaseUrl` is a configuration-breaking change from the
  superseded reset implementation. Users must move reset configuration into
  each intended fan's `endpoints.reset` entry.
- Existing fan configurations without reset continue working and expose no
  reset Switch.
- Existing fan accessory UUIDs do not change.
- Cached fan accessories gain or lose only the reset Switch service according
  to current configuration.
- The cached global reset accessory is unregistered once and is not recreated.
- A reset failure affects only that fan's reset activation.
- No change is permitted to existing fan endpoint requests or Fanv2 behavior.

## Validation Plan

- Add deterministic tests proving:
  - device configurations without `endpoints.reset` expose no reset Switch;
  - valid per-fan reset configuration exposes one reset Switch on that fan's
    existing accessory and creates no separate accessory;
  - reset service addition/removal reconciles correctly on cached fan
    accessories;
  - the cached global reset accessory is removed;
  - reset URIs reject non-HTTP(S), wrong paths, queries, fragments, credentials,
    and non-POST methods without disabling other fan controls;
  - the fan's `timeoutMs` and five-second default are applied;
  - one idle ON activation produces exactly one bodyless POST to the configured
    reset URI and only `202` succeeds;
  - OFF writes produce no request;
  - same-fan concurrent ON writes coalesce while different-fan requests remain
    independent;
  - success and every failure return only the reset Switch to OFF;
  - failures become HomeKit communication failures and remain retryable;
  - existing fan registration, power, speed, rotation, and status tests remain
    unchanged or are extended as regression coverage.
- Validate both `config.schema.json` and the package-embedded Homebridge schema.
- Run `npm test`, `npm run lint`, `npm run build`, `npm run prepublishOnly`, and
  `git diff --check`.
- Use local fakes or loopback HTTP only; do not contact a live API during
  deterministic tests.
- If Homebridge/Home runtime validation is unavailable, keep delivery DRAFT and
  list the unverified same-accessory service presentation explicitly.

## Documentation Requirements

- Document optional `devices[].endpoints.reset` in README, both schemas, and
  `config.example.json`.
- Remove top-level `apiBaseUrl` documentation and schema entries.
- Explain that reset is a momentary Switch service on the configured fan's
  existing accessory, not a separate accessory.
- Document the bodyless POST, exact `202` success rule, timeout, no-retry
  behavior, unauthenticated request, failure behavior, and application-state-only
  limitation.
- Document migration from the superseded top-level `apiBaseUrl` configuration.

## Acceptance Criteria

- A configured fan without `endpoints.reset` has no reset control.
- A configured fan with a valid reset endpoint has exactly one momentary reset
  Switch service on its existing fan accessory.
- The platform creates no separate reset accessory.
- The fan accessory UUID is unchanged when reset configuration changes.
- One idle activation sends exactly one bodyless POST to that fan's configured
  reset URI; only `202 Accepted` succeeds.
- The reset Switch returns to OFF after every outcome and OFF writes never call
  the endpoint.
- Concurrent activations coalesce per fan, not across fans.
- Invalid reset configuration and request failures are contained, logged without
  secrets, surfaced as HomeKit communication failures when applicable, and do
  not affect existing fan controls.
- Cached global reset accessories and stale per-fan reset services are removed.
- Existing fan power, speed, rotation, status, authentication, identity, and
  cache behavior remain unchanged.
- Runtime configuration, both schemas, example configuration, tests, and README
  agree.
- Required deterministic validation passes, or delivery is explicitly DRAFT
  with each unavailable validation step listed.
