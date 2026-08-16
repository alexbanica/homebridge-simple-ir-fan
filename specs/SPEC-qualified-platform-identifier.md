# Qualified Homebridge Platform Identifier

Status: Approved

## Purpose

Ensure Homebridge deterministically loads the scoped
`@alexlab/homebridge-simple-ir-fan` package when another installed plugin also
registers the `SimpleIrFan` platform alias.

## Requested Behavior

The published configuration contract and examples use
`@alexlab/homebridge-simple-ir-fan.SimpleIrFan` as the platform identifier.
Runtime accessory registration uses the package's scoped plugin identifier.

## Scope

- Align the runtime plugin identifier with the scoped `package.json` name.
- Require and demonstrate the qualified platform identifier in configuration.
- Document why the qualified identifier is required.
- Add deterministic contract coverage for these identifiers.

## Out of Scope

- Uninstalling or disabling the legacy `homebridge-simple-ir-fan` package.
- Renaming the `SimpleIrFan` platform alias.
- Modifying a user's deployed Homebridge `config.json` or restarting Homebridge.

## Inputs and Constraints

- Package identifier: `@alexlab/homebridge-simple-ir-fan`.
- Platform alias: `SimpleIrFan`.
- Homebridge accepts the qualified form `<plugin>.<platform>` to resolve aliases
  registered by multiple plugins.
- Existing fan and endpoint behavior remains unchanged.

## Deterministic Behavior Delivered

1. `config.schema.json` accepts only
   `@alexlab/homebridge-simple-ir-fan.SimpleIrFan` for `platform`.
2. `config.example.json` and the README demonstrate the same value.
3. Accessory registration and unregistration use
   `@alexlab/homebridge-simple-ir-fan`, matching `package.json`.
4. Automated contract assertions fail if these identifiers drift apart.

## Assumptions

- The scoped package is the intended plugin selection.
- A deployed Homebridge configuration will be migrated separately by its
  operator.

## Impact

Existing configurations using the ambiguous short alias must replace
`"platform": "SimpleIrFan"` with the qualified value. Fan accessory UUIDs and
endpoint configuration are unaffected.

## Validation Performed

- Identifier contract test passed as part of `test/configSchema.test.ts`.
- `npm run build` passed.
- `git diff --check` passed.

## Validation Skipped

- Live Homebridge startup with both packages installed.
- Deployed configuration migration and restart.

## Validation Not Passing

- The full `npm test` run passed 8 of 9 compiled test files; the unrelated
  `publishForgejoPackage.test.ts` file failed in its child-process harness.
- `npm run lint` reported pre-existing CRLF line endings in
  `src/@types/homebridge-lib.d.ts`, which this change does not modify.

## Documentation Changes

The README now identifies both the platform alias and the qualified configured
identifier, including the duplicate-installation rationale.
