# SPEC-001 - Homebridge Fan Reset Trigger

Status: Approved
Date: 2026-08-10

## Purpose

Expose the Device Integration API fan reset action in HomeKit so a user can
deliberately reset the API-owned fan state from Homebridge.

## Problem

The Device Integration API provides `POST /api/v1/fan/reset`, but this
Homebridge plugin has no control that invokes it. The checked-in plugin is still
the Homebridge dynamic-platform example and exposes only example accessories
whose state is local to the plugin.

## Scope

In scope:

- Expose one HomeKit Switch service that acts as a momentary fan reset trigger.
- Add a Homebridge configuration value for the Device Integration API base URL.
- Invoke the existing `POST /api/v1/fan/reset` contract without a request body.
- Treat only HTTP `202 Accepted` as a successful reset.
- Keep the trigger deterministic across success, failure, repeated writes,
  Homebridge restarts, and cached-accessory restoration.
- Contain configuration, network, protocol, and timeout failures so the plugin
  does not produce unhandled exceptions.
- Replace the checked-in example accessories and their synthetic state changes
  with the single reset-trigger accessory.

Out of scope:

- Starting, stopping, rotating, changing speed, or otherwise controlling the
  physical fan.
- Querying `GET /api/v1/fan/state` or synchronizing API fan state into HomeKit.
- Changing the Device Integration API, its OpenAPI contract, or its persistence
  behavior.
- Adding authentication, authorization, retries, telemetry, command history, or
  audit events.
- Renaming or publishing the npm package, or changing plugin/platform public
  identifiers beyond what is necessary to expose the reset trigger.
- Providing a guarantee that the physical fan is OFF after reset. The API reset
  action changes and persists application state only.

## Definitions

- **Reset endpoint:** `POST /api/v1/fan/reset` from the Device Integration API
  OpenAPI contract.
- **Reset trigger:** A HomeKit Switch service used as a momentary action. It is
  OFF while idle, becomes ON while its reset request is pending, and returns to
  OFF when that request settles.
- **API base URL:** The absolute HTTP or HTTPS origin of the Device Integration
  API, without the versioned reset path. A single trailing slash is permitted.
- **Reset in progress:** The interval from accepting an idle-to-ON HomeKit write
  until the corresponding HTTP request succeeds, fails, or times out.
- **Idle:** No reset request is in progress and the reset trigger reports OFF.

## Inputs And Constraints

- The Homebridge platform configuration retains the required `name` property.
- The platform configuration adds optional `apiBaseUrl` as an absolute
  `http://` or `https://` URL. When omitted, runtime behavior defaults it to
  `http://localhost:3000`, matching the OpenAPI server URL.
- `apiBaseUrl` represents an origin. Apart from an optional trailing slash, it
  must not contain a path, query string, or fragment.
- The reset request URL is the normalized API base URL followed by
  `/api/v1/fan/reset` exactly once.
- The request method is `POST` and the request has no body.
- The request timeout is five seconds.
- Reset requests are not retried automatically.
- The API contract defines no authentication for this endpoint, so the plugin
  sends no authentication credentials.
- The trigger accessory has one stable UUID that does not depend on the API base
  URL, so changing the server address does not create a duplicate accessory.
- Homebridge, HomeKit, HTTP, logging, filesystem, and runtime concerns remain
  outside domain and application contracts in accordance with the repository's
  onion-architecture dependency direction.

## Deterministic Behavior

### 1. Platform startup and configuration

- With a valid configuration, the platform exposes exactly one reset-trigger
  accessory and one Switch service for the configured platform `name`.
- A newly created or restored trigger reports OFF when no reset is in progress.
- Cached accessories from the checked-in example implementation are not exposed
  as active devices and are removed through normal dynamic-platform accessory
  reconciliation.
- If a supplied `apiBaseUrl` is invalid at runtime, the platform logs a concise
  configuration error, performs no outbound request, and exposes no usable reset
  trigger. The configuration error must not escape as an unhandled exception.

### 2. Idle trigger activation

- When HomeKit writes ON while the trigger is idle, the trigger starts exactly
  one reset request and reports ON while that request is pending.
- The request is `POST <normalized-api-base-url>/api/v1/fan/reset` with no
  request body.
- A `202 Accepted` response completes the action successfully. The response body
  is not parsed and does not affect the result.
- After success, the trigger returns to OFF and Homebridge logs the successful
  reset at an informational level.
- Homebridge does not infer, query, or publish physical fan state after success.

### 3. OFF writes and concurrent activation

- A HomeKit write of OFF never invokes the reset endpoint and leaves the trigger
  OFF when idle.
- If HomeKit writes ON while a reset is already in progress, the plugin does not
  send another HTTP request. The write observes the result of the in-progress
  reset and the trigger returns to OFF when that request settles.
- After a completed request has returned the trigger to OFF, a later ON write is
  a new deliberate activation and sends one new reset request.

### 4. Failure handling

- A timeout, network error, or any HTTP status other than `202` is a failed
  reset.
- On failure, the trigger returns to OFF, Homebridge records a concise error that
  identifies the reset action without logging secrets, and the HomeKit write is
  reported as a service communication failure.
- A failed reset is not retried and does not prevent a later deliberate ON write
  from trying again.
- All asynchronous failures are caught within the plugin boundary; none may
  become an unhandled rejection or terminate Homebridge.

### 5. API action meaning

- Successful invocation means the API accepted and persisted its default OFF
  application state: `isOn=false`, `speed=0`, and `isRotating=false`.
- The trigger does not claim that the API issued an IR command or reconciled the
  physical fan. The referenced API reset contract explicitly excludes physical
  fan commands.

## Assumptions

- Homebridge can reach the configured API base URL from its own runtime network.
- The OpenAPI contract and approved API reset spec remain authoritative for the
  endpoint method, path, lack of request body, and response statuses.
- A momentary Switch is the intended HomeKit affordance for a user-initiated
  action because HomeKit does not expose a native push-button service for this
  plugin use case.
- The current endpoint remains unauthenticated. Authentication requires a new
  approved behavior change if the API contract changes.
- Five seconds is sufficient for the API to persist its reset state under normal
  operating conditions.

## Regression Impact

- The three checked-in example accessories, Brightness handler, and periodic
  synthetic MotionSensor changes cease to be active plugin behavior.
- Existing Homebridge caches may contain those example accessories; discovery
  must reconcile and remove them without duplicate UUIDs or repeated removals.
- A reset endpoint failure affects only that trigger activation. The platform
  remains loaded and later activations remain possible.
- Changing `apiBaseUrl` changes the request destination but not the accessory
  identity.
- No change is permitted to the Device Integration API or to other fan endpoint
  behavior.

## Validation Plan

- Add deterministic tests proving:
  - the omitted-base-URL default, valid explicit base URLs, optional
    trailing-slash normalization, and rejection of invalid base URLs;
  - one idle ON activation produces exactly one bodyless `POST` to the exact
    reset path;
  - only HTTP `202` is accepted as success;
  - the trigger is OFF initially and after both success and failure;
  - OFF writes produce no request;
  - concurrent ON writes share one in-progress request and do not duplicate the
    action;
  - timeout, network, and unexpected-status failures are contained and reported
    as HomeKit service communication failures;
  - a failed activation can be followed by a successful activation;
  - cached example accessories are removed and the stable reset accessory is
    restored without duplication.
- Run `npm run lint`, `npm run build`, and `npm run prepublishOnly`.
- Run the repository's implemented deterministic test command after a test
  entry point is added.
- Run `git diff --check`.
- Verify the request against a local contract-compatible HTTP test server.
- If an actual Homebridge/Home app and reachable Device Integration API are
  unavailable, report that runtime/UI integration validation was not run and
  keep implementation delivery in DRAFT status.

## Documentation Requirements

- Replace template README guidance with configuration and behavior documentation
  for `name`, `apiBaseUrl`, the momentary reset trigger, success/failure behavior,
  and the fact that reset does not physically control the fan.
- Keep `config.schema.json`, example Homebridge configuration, and runtime
  validation aligned.
- Reference the upstream Device Integration API reset contract without copying
  or changing that contract in this repository.

## Acceptance Criteria

- A valid configuration exposes exactly one momentary HomeKit reset Switch.
- One idle-to-ON activation sends exactly one bodyless
  `POST /api/v1/fan/reset` request to the configured API origin.
- Only `202 Accepted` is reported as success.
- The trigger returns to OFF after every request outcome and OFF writes never
  call the endpoint.
- Concurrent activations do not create duplicate reset requests.
- Failures are logged, surfaced to HomeKit as communication failures, and do not
  escape the plugin boundary.
- The plugin does not query or claim physical fan state and does not invoke any
  other API action.
- The existing example accessories and synthetic state changes are no longer
  exposed.
- Configuration schema, runtime behavior, tests, and README documentation agree.
- Required deterministic validation passes, or the delivery is explicitly
  reported as DRAFT with every unavailable validation step listed.
