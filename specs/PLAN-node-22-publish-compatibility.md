# Node 22 Publish Compatibility Completed Plan

Status: Approved

## Spec Reference

`specs/SPEC-node-22-publish-compatibility.md`

## Affected Files

- `.github/workflows/publish.yml`
- `test/publishWorkflow.test.ts`
- `specs/SPEC-node-22-publish-compatibility.md`
- `specs/PLAN-node-22-publish-compatibility.md`

## Implementation Steps Performed

1. Updated the workflow assertion to require Node.js 22 and `actions/setup-node@v6`.
2. Ran the deterministic suite and confirmed the assertion failed against the previous workflow.
3. Changed the publish setup step from Node.js 24 to Node.js 22.
4. Changed the setup action from `actions/setup-node@v4` to `actions/setup-node@v6`.
5. Updated the workflow assertion to require dependency installation directly from the public npm registry and confirmed it failed against the previous bare `npm ci` step.
6. Changed the install step to run `npm ci --registry=https://registry.npmjs.org/` without broadening token exposure.
7. Re-ran the deterministic suite and confirmed all tests passed.
8. Recorded the completed behavior and validation boundaries in approved post-change artifacts.

## Validation Run

- First pre-implementation `npm test`: expected failure for the Node.js and setup-node assertion; 71 passed and 1 failed.
- Second pre-implementation `npm test`: expected failure for the dependency-registry assertion; 71 passed and 1 failed.
- Post-implementation `npm test`: passed, 72 tests.
- `git diff --check`: passed before staging.
- Staged path and staged diff inspection: passed after staging.

## Validation Skipped

- Separate `npm run build`, `npm run lint`, and `npm run prepublishOnly` commands.
- Hosted GitHub Actions execution.
- Live Forgejo authentication and package publication.

## QA Skipped

Independent QA was skipped by design for direct `super-agent` execution.

## Code Review Skipped

Independent code review was skipped by design for direct `super-agent` execution.

## Documentation Updates

No user-facing documentation update was necessary because the change only aligns the publish runtime and setup action with existing compatibility requirements.

## Staging Status

All four accepted in-scope files are staged. No intended path remains unstaged or untracked.

## Commit Status

Not committed, as required by the `super-agent` workflow unless explicitly requested.

## Push Status

Not pushed, as required by the `super-agent` workflow unless explicitly requested.

## Residual Risk

Delivery remains DRAFT until the hosted workflow completes with Node.js 22, authenticates to Forgejo, and publishes or verifies a real package without the reported warnings.
