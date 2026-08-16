# API-Backed Fan Rotation State

Status: Approved

## Purpose

Make the HomeKit Rotation switch reflect the Device Integration API's reported
rotation state instead of behaving only as a momentary action trigger.

## Requested Behavior

Read `isRotating` from each fan's configured `getStatus` endpoint, expose that
boolean through the existing Rotation switch, and avoid sending a toggle command
when HomeKit already requests the reported state.

## Scope

- Map boolean `FanStatus.isRotating` values into the fan domain state.
- Refresh API rotation status at startup and on Rotation switch reads.
- Compare ON and OFF writes with current API state.
- Call the existing rotation toggle endpoint only when the requested state
  differs.
- Preserve the stable `fan-rotation-toggle` service subtype and existing
  endpoint contract.
- Update deterministic tests and README behavior documentation.

## Out of Scope

- Reintroducing the Fanv2 `SwingMode` characteristic.
- Changing the `/api/v1/fan/rotate` request or accepted HTTP status.
- Polling rotation state in the background.
- Claiming the API's tracked IR state is direct physical-device feedback.

## Definitions

- **Reported rotation state:** the boolean `isRotating` value returned by
  `devices[].endpoints.getStatus`.
- **Requested rotation state:** the boolean ON or OFF value written by HomeKit.
- **Toggle action:** the existing bodyless `POST` to
  `devices[].endpoints.rotate.uri`, successful only on HTTP `202`.

## Inputs And Constraints

- `getStatus` may omit `isRotating` for backward compatibility.
- The rotation endpoint toggles rather than accepting an explicit target state.
- Existing fan-level authentication applies to `getStatus`; the rotation action
  remains unauthenticated as previously documented.
- Homebridge-facing failures must remain contained as HAP communication errors.

## Deterministic Behavior Delivered

1. A boolean `isRotating` response replaces the fan's last known rotation state.
2. A missing or non-boolean `isRotating` value preserves the last known state.
3. Startup refresh pushes the API-backed state into the Rotation switch.
4. A Rotation switch read refreshes `getStatus` and returns the resulting state.
5. A write first refreshes status. If requested and reported states match, no
   toggle request is sent.
6. If states differ, one toggle request is sent and an accepted action stores
   the requested state until a later status response supersedes it.
7. A failed toggle restores the previous state and surfaces
   `SERVICE_COMMUNICATION_FAILURE`.
8. Existing same-fan action coalescing and cross-fan independence remain.

## Assumptions

- The Device Integration API updates `isRotating` consistently with accepted
  toggle actions.
- Preserving the existing Switch service avoids cached-accessory churn.

## Impact

The Rotation switch is now stateful. OFF writes may contact the rotation
endpoint when the API reports rotation ON, while matching writes become no-ops.

## Validation Performed

- Focused `platformAccessory` test file passed.
- TypeScript build passed.
- `git diff --check` passed.

## Validation Not Passing

- The full test run passed 8 of 9 compiled test files; the unrelated
  `publishForgejoPackage` child-process harness failed as it did before this
  change.
- Lint reported existing CRLF line endings in the unchanged
  `src/@types/homebridge-lib.d.ts` file.

## Validation Skipped

- Live Homebridge and Device Integration API validation.
- Physical fan-state validation.

## Documentation Changes

The README now describes API-backed reads, state-aware writes, missing-field
compatibility, and the boundary between tracked API state and physical state.
