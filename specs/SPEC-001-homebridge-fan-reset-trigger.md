# SPEC-001 - Homebridge Fan Reset And Rotation Triggers

Status: Approved
Date: 2026-08-10
Updated: 2026-08-14

## Iteration: Reset-Style Per-Fan Rotation Toggle

This iteration adds an optional momentary Rotation Toggle Switch to each
configured fan and supersedes the existing stateful `SwingMode`,
`startRotation`, and `stopRotation` integration.

Delta from the previously approved behavior:

- Add optional `devices[].endpoints.rotate` alongside the approved per-fan
  `reset` endpoint.
- Expose rotation as a second, independently configured momentary Switch service
  on the same HomeKit accessory as the fan and Reset Switch.
- Replace the existing `Fanv2.SwingMode` handlers and separate
  `startRotation`/`stopRotation` endpoint configuration with one physical-toggle
  action.
- Invoke the Device Integration API's bodyless
  `POST /api/v1/fan/rotate` contract with the same strict transport, timeout,
  coalescing, state-transition, and failure-containment rules used by reset.
- Preserve every approved reset behavior and all existing Fanv2 power, speed,
  status, authentication, identity, and cache behavior except where removal of
  the superseded SwingMode integration is explicitly described.

## Preserved Iteration: Optional Per-Fan Reset Control

The approved reset behavior remains unchanged:

- Reset configuration is optional under `devices[].endpoints.reset`.
- Reset is a momentary Switch on the configured fan's existing accessory.
- No separate reset accessory or top-level `apiBaseUrl` is used.
- Cached reset services and the superseded global reset accessory are reconciled
  without changing configured fan identity.

## Purpose

Allow each configured fan to opt into the Device Integration API reset and
physical rotation-toggle actions without creating separate HomeKit accessories
or representing a physical toggle command as deterministic ON/OFF state.

## Problem

Reset is already modeled correctly as an optional momentary action on each fan.
Rotation is currently modeled differently: `Fanv2.SwingMode` ON and OFF writes
select separate `startRotation` and `stopRotation` endpoints even though the
example points both fields to one physical-toggle command.

The current Device Integration API exposes only bodyless
`POST /api/v1/fan/rotate`. Its OpenAPI labels the operation as a toggle, while
its current service persists `isRotating=true` whenever the fan is powered.
Consequently, Homebridge cannot safely claim deterministic desired ON/OFF state
from this endpoint. Rotation must be presented as a momentary action, like
reset, with no final-state claim.

## Scope

In scope:

- Keep optional per-fan reset configuration and behavior unchanged.
- Add optional per-fan `endpoints.rotate` configuration.
- Attach a momentary Rotation Toggle Switch to the same fan accessory.
- Send bodyless `POST` requests to the configured reset or rotation URI.
- Treat only HTTP `202 Accepted` as action success.
- Use per-fan timeout, no retry, per-action coalescing, contained failures, and
  deterministic pending-to-idle Switch transitions.
- Remove `endpoints.startRotation` and `endpoints.stopRotation` from runtime
  configuration, TypeScript DTOs, both schemas, examples, and documentation.
- Remove active `Fanv2.SwingMode` handlers and reconcile the superseded
  characteristic where the Homebridge API permits it.
- Reconcile optional Reset and Rotation Toggle services on cached fan
  accessories without changing fan accessory identity.
- Preserve fan power, speed, status, authentication, registration, restoration,
  and removal behavior.

Out of scope:

- Changing the Device Integration API, OpenAPI, persistence, terminal command,
  or IR behavior.
- Claiming reset changed the physical fan state.
- Claiming rotation is now ON or OFF after the API accepts a toggle command.
- Reading or publishing `isRotating` through the new Rotation Toggle Switch.
- Retaining stateful SwingMode or supporting old and new rotation configuration
  shapes concurrently.
- Adding request bodies, headers, query parameters, authentication, retries,
  telemetry, history, or audit events to reset or rotation actions.
- Creating separate HomeKit accessories for reset or rotation.
- Providing native HomeKit push-button services; momentary Switch services are
  used because HomeKit has no native button service for these actions.

## Definitions

- **Configured fan:** One entry in the platform's `devices` array.
- **Reset endpoint:** Optional `devices[].endpoints.reset` with an absolute URI
  and method fixed to `POST`.
- **Rotation endpoint:** Optional `devices[].endpoints.rotate` with an absolute
  URI and method fixed to `POST`.
- **Reset Switch:** Momentary Switch on the fan accessory whose ON action asks
  the Device Integration API to reset application state.
- **Rotation Toggle Switch:** Momentary Switch on the fan accessory whose ON
  action asks the Device Integration API to execute its physical rotation
  toggle command.
- **Action in progress:** The interval from accepting an idle-to-ON write until
  that action's HTTP request succeeds, fails, or times out.
- **Action idle:** No request for that specific action is in progress. Reset and
  rotation have independent idle states.

## Inputs And Constraints

### Reset configuration

- `devices[].endpoints.reset` is optional.
- When present it contains only:
  - `uri`: absolute HTTP(S) URI with exact path `/api/v1/fan/reset`;
  - `method`: exactly `POST`.
- Query strings, fragments, embedded credentials, body templates, headers,
  authentication, and extra properties are prohibited.

### Rotation configuration

- `devices[].endpoints.rotate` is optional.
- When present it contains only:
  - `uri`: absolute HTTP(S) URI with exact path `/api/v1/fan/rotate`;
  - `method`: exactly `POST`.
- Query strings, fragments, embedded credentials, body templates, headers,
  authentication, and extra properties are prohibited.
- `startRotation` and `stopRotation` are no longer accepted.

### Shared action constraints

- Requests are bodyless and unauthenticated. Existing `devices[].auth` is not
  applied to Device Integration API reset or rotation actions.
- Each request uses that fan's `timeoutMs`, defaulting to 5000 milliseconds.
- Requests are not retried automatically.
- Only HTTP `202 Accepted` is successful; response bodies are ignored.
- Concurrent writes for the same action on the same fan share one in-flight
  request and outcome log.
- Different fans remain independent.
- Reset and rotation on the same fan remain independent and do not coalesce or
  block one another.
- Fan accessory UUID remains generated from `serialNumber:name`; action
  configuration does not change identity.
- Reset and Rotation Toggle use distinct stable service subtypes.
- Domain and application contracts remain independent of Homebridge, HomeKit,
  HTTP, logging, filesystem, and runtime concerns under the repository's onion
  architecture.

## Deterministic Behavior

### 1. Platform startup and reconciliation

- The platform registers and restores configured fan accessories as before.
- No platform-level reset or rotation accessory is created.
- A valid reset endpoint produces exactly one Reset Switch on the fan accessory.
- A valid rotate endpoint produces exactly one Rotation Toggle Switch on the
  fan accessory.
- Missing action configuration produces no Switch for that action.
- Reset and rotation configuration may be enabled independently.
- Adding an action to a restored fan adds only that stable-subtype Switch.
- Removing an action removes only its cached Switch and preserves Fanv2 and the
  other action.
- The superseded cached global reset accessory is removed through normal UUID
  reconciliation.
- Fanv2 no longer binds SwingMode get/set handlers. A cached SwingMode
  characteristic is removed where supported and is never rebound as an active
  control.
- Invalid action configuration logs one concise device-specific configuration
  error without secrets, exposes no usable Switch for that action, and preserves
  the fan and the other action.
- Configuration and service-reconciliation failures are contained within the
  plugin boundary.

### 2. Momentary action activation

- An ON write while that action is idle starts exactly one request.
- The corresponding Switch reports ON while its request is pending.
- Reset sends a bodyless `POST` to `/api/v1/fan/reset`.
- Rotation sends a bodyless `POST` to `/api/v1/fan/rotate`.
- A `202 Accepted` response succeeds regardless of response body.
- Success returns only the corresponding Switch to OFF and logs one concise
  informational result for the configured fan.
- OFF writes make no request and leave an idle Switch OFF.
- A concurrent ON write for the same action and fan shares the in-flight result.
- A later ON write after settlement starts a new request.
- Different fans and different actions on one fan remain independent.

### 3. Failure handling

- Timeout, network error, invalid runtime configuration, or any status other
  than `202` fails that action.
- Failure returns only the corresponding Switch to OFF.
- Homebridge logs one concise device-specific error without endpoint secrets.
- HomeKit receives `SERVICE_COMMUNICATION_FAILURE` for the failed write.
- Failures are not retried and do not prevent later deliberate activation.
- Reset failure does not affect rotation or Fanv2; rotation failure does not
  affect reset or Fanv2.
- All asynchronous failures are caught within the plugin boundary and cannot
  become unhandled rejections or terminate Homebridge.

### 4. Action meaning

- Reset success means only that the API accepted and persisted its default
  application state: `isOn=false`, `speed=0`, `isRotating=false`. It does not
  claim an IR command ran or the physical fan changed.
- Rotation success means only that the API accepted its physical toggle command.
  It does not claim rotation is now ON or OFF, publish `isRotating`, or correct
  the API's current persisted-state semantics.
- Neither action changes, queries, or publishes Fanv2 power or speed state.

## Assumptions

- Homebridge can reach each configured action URI.
- Current Device Integration API OpenAPI and controller contracts are
  authoritative for method, path, absence of request body, and response status.
- Reset and rotation API actions are unauthenticated.
- Home may render secondary services as separate tiles, but both Switches remain
  services of the existing fan accessory and receive no accessory UUID.
- Existing configured-fan power, speed, status, identity, and cache behavior on
  the current branch remain the regression baseline.

## Regression And Compatibility Impact

- Approved reset configuration and behavior remain compatible.
- Removing `startRotation` and `stopRotation` is a deliberate configuration
  break. Users must replace them with one optional `endpoints.rotate` entry.
- Stateful Fanv2 SwingMode is deliberately removed and replaced by a momentary
  Rotation Toggle action.
- Configurations without reset or rotation continue exposing the existing fan
  power, speed, and status behavior.
- Fan accessory UUIDs remain unchanged.
- Cached accessories gain or lose only the applicable action services and the
  superseded SwingMode characteristic.
- A failure affects only the invoked action for that fan.

## Validation Plan

- Add deterministic tests proving:
  - optional reset behavior remains unchanged;
  - optional rotate configuration adds exactly one stable Rotation Toggle
    Switch to the existing fan accessory and creates no separate accessory;
  - missing or invalid rotate configuration produces no Rotation Toggle Switch
    while preserving Fanv2 and Reset;
  - cached Rotation Toggle add/remove reconciliation preserves fan UUID and
    other services;
  - SwingMode handlers and `startRotation`/`stopRotation` configuration are
    absent;
  - strict rotate URI validation rejects wrong schemes, paths, queries,
    fragments, credentials, malformed ports, extra fields, and non-POST methods;
  - rotate requests are bodyless, unauthenticated, use per-fan/default timeout,
    do not retry, and accept only `202`;
  - ON remains pending until settlement, OFF makes no request, and all outcomes
    return the action Switch to OFF;
  - same-fan same-action writes coalesce while different fans and reset/rotation
    actions remain independent;
  - failures are secret-safe, map to HomeKit communication failures, remain
    retryable, and do not alter other controls;
  - existing power, speed, status, registration, restoration, and reset tests
    remain passing.
- Validate `config.schema.json`, the package-embedded schema, DTOs, and
  `config.example.json` for identical action contracts.
- Run `npm test`, `npm run lint`, `npm run build`, `npm run prepublishOnly`, and
  `git diff --check`.
- Deterministic tests use fakes, injected fetch, or loopback HTTP only.
- Starting Homebridge/Home or calling a live API requires explicit user
  authorization and target confirmation.
- If runtime validation is unavailable, delivery remains DRAFT and lists the
  unverified same-accessory service presentation explicitly.

## Documentation Requirements

- Preserve the existing reset migration and behavior documentation.
- Document optional `devices[].endpoints.rotate` in README, both schemas, and
  `config.example.json`.
- Document migration from `startRotation`/`stopRotation` and stateful SwingMode
  to the momentary Rotation Toggle Switch.
- Document the exact bodyless `/api/v1/fan/rotate` POST contract, exact `202`
  success, timeout, no retry, unauthenticated behavior, pending/OFF transitions,
  coalescing, and failure behavior.
- State explicitly that Rotation Toggle is an action and does not report or
  guarantee final physical or persisted rotation state.

## Acceptance Criteria

- All previously approved reset acceptance criteria remain satisfied.
- A fan without `endpoints.rotate` has no Rotation Toggle control.
- A fan with a valid rotate endpoint has exactly one momentary Rotation Toggle
  Switch on its existing accessory and no separate accessory.
- One idle activation sends exactly one bodyless unauthenticated POST to the
  configured `/api/v1/fan/rotate` URI; only `202 Accepted` succeeds.
- The Switch is ON only while pending, returns OFF after every outcome, and OFF
  writes never call the API.
- Concurrent rotation activations coalesce per fan, not across fans or with
  reset.
- Invalid rotation configuration and request failures are contained,
  secret-safe, retryable, and isolated from Fanv2 and Reset controls.
- `startRotation`, `stopRotation`, and active SwingMode handlers are absent.
- Power, speed, status, authentication, identity, registration, restoration,
  reset, and unrelated cache behavior remain unchanged.
- Runtime config, TypeScript DTOs, both schemas, example config, tests, and README
  agree.
- Required deterministic validation passes, or delivery is explicitly DRAFT
  with every unavailable validation step listed.
