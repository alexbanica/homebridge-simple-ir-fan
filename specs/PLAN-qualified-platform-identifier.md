# Qualified Homebridge Platform Identifier Plan

Status: Approved

## Spec Reference

`specs/SPEC-qualified-platform-identifier.md`

## Affected Files

- `src/settings.ts`
- `config.schema.json`
- `config.example.json`
- `README.md`
- `test/configSchema.test.ts`
- `specs/SPEC-qualified-platform-identifier.md`
- `specs/PLAN-qualified-platform-identifier.md`

## Implementation Steps Performed

1. Changed the runtime plugin identifier to the scoped package name.
2. Qualified the platform value in the external schema and example.
3. Documented the required configuration migration.
4. Added contract assertions tying runtime, package, schema, and example
   identifiers together.
5. Recorded the delivered behavior in the approved spec and this plan.

## Validation Run

- Identifier contract test: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Full `npm test`: 8 of 9 compiled test files passed; the unrelated publishing
  test file failed in its child-process harness.
- `npm run lint`: failed on pre-existing CRLF line endings in
  `src/@types/homebridge-lib.d.ts`.

## Validation Skipped

- Live Homebridge startup and runtime migration.

## QA

Skipped by the requested super-agent workflow.

## Code Review

Skipped by the requested super-agent workflow.

## Documentation Updates

Updated the README configuration identifiers and duplicate-platform guidance.

## Staging Status

All accepted in-scope paths are staged for user review.

## Commit Status

Not committed, as required by the super-agent default.

## Push Status

Not pushed, as required by the super-agent default.

## Residual Risk

Live startup remains unverified. The operator must update the deployed
Homebridge configuration and restart Homebridge to confirm the ambiguity is
resolved in that environment.
