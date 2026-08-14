# Publish Test Environment Isolation

Status: Approved

## Purpose

Keep publish-script tests deterministic when they run inside a release job that already defines `RELEASE_TAG` and `NODE_AUTH_TOKEN`.

## Requested Behavior

- Prevent ambient test-runner, release, and authentication variables from leaking into individual publish-script test invocations.
- Allow each test invocation to opt into explicit `RELEASE_TAG` and `NODE_AUTH_TOKEN` values.
- Preserve all production publish behavior.

## Scope

- `test/publishForgejoPackage.test.ts`
- Completed-work spec and plan artifacts.

## Out Of Scope

- Changing `scripts/publish-forgejo.mjs`.
- Changing the publish workflow, tag contract, registry, authentication, package contents, or release behavior.
- Running a live Forgejo publication.

## Inputs And Constraints

- The publish script launches `npm test` from a step where `RELEASE_TAG` is defined.
- Node.js may set `NODE_TEST_CONTEXT` and `NODE_TEST_WORKER_ID` while executing the test suite; the application subprocess must not inherit these test-runner control values.
- Test cases that verify missing release metadata must not inherit that outer value.
- Test cases must continue inheriting unrelated process environment required to locate Node.js and system tools.

## Deterministic Behavior Delivered

1. The test invocation helper copies the ambient process environment.
2. It removes ambient `NODE_TEST_CONTEXT`, `NODE_TEST_WORKER_ID`, `RELEASE_TAG`, and `NODE_AUTH_TOKEN` values.
3. It applies only the environment values explicitly supplied by each test case.
4. Explicit `undefined` values remove the corresponding child variable instead of becoming string values.
5. The missing-tag and missing-authentication cases therefore remain valid inside a release job.

## Assumptions

- Test-first production development is not applicable because the defect is isolated to the test harness; the existing failing test is the regression check.

## Impact

`npm test` no longer fails merely because it was launched from the authenticated publish step with a valid release tag.

## Validation Performed

- Full `npm test` with ambient beta-tag and token values injected: all 72 tests passed, including the publish-script and publish-workflow suites.
- `git diff --check`.
- Staged path and staged diff inspection.

## Validation Skipped

- Separate lint, build, and prepublish commands because the `super-agent` workflow permits only validation expected to complete within 10 seconds.
- Hosted workflow execution and live Forgejo publication.
- Independent QA and code review, as required by the `super-agent` workflow.

## Documentation Changes

No user-facing documentation changed because production behavior is unchanged.

## Residual Risk

The complete hosted publish path remains unverified until a new numeric release tag runs the corrected tests and publishes successfully.
