# Numeric Release Tags Completed Plan

Status: Approved

## Spec Reference

`specs/SPEC-numeric-release-tags.md`

## Affected Files

- `.github/workflows/publish.yml`
- `scripts/publish-forgejo.mjs`
- `test/publishWorkflow.test.ts`
- `test/publishForgejoPackage.test.ts`
- `README.md`
- `specs/SPEC-numeric-release-tags.md`
- `specs/PLAN-numeric-release-tags.md`

## Implementation Steps Performed

1. Replaced the `v*` workflow trigger with a coarse numeric release-tag filter.
2. Replaced stable-only leading-`v` parsing with exact stable and `-betaN` validation.
3. Used the accepted Git tag unchanged as the npm package version.
4. Selected `latest` for stable releases and `beta` for beta releases.
5. Made post-publish metadata verification check the selected npm dist-tag.
6. Updated deterministic workflow and publish-script tests for the new contract.
7. Updated release documentation and install examples.

## Validation Run

- `npm test`: passed, 72 tests.
- `git diff --check`: passed before staging.
- Staged path and staged diff inspection: passed after staging.

## Validation Skipped

- `npm run lint` and `npm run build` as separate commands; the short `npm test` command compiled the test project and exercised the complete deterministic suite.
- GitHub Actions execution from an actual pushed tag.
- Live Forgejo publish and package installation.

## QA Skipped

Independent QA was skipped by design for direct `super-agent` execution.

## Code Review Skipped

Independent code review was skipped by design for direct `super-agent` execution.

## Documentation Updates

Updated `README.md` to describe numeric stable and beta release tags, dist-tag selection, and beta installation.

## Staging Status

All seven accepted in-scope files are staged. No intended path remains unstaged or untracked.

## Commit Status

Not committed, as required by the `super-agent` workflow unless explicitly requested.

## Push Status

Not pushed, as required by the `super-agent` workflow unless explicitly requested.

## Residual Risk

Delivery remains DRAFT until a trusted numeric tag exercises the hosted workflow and the published stable or beta package is verified from Forgejo. GitHub's coarse tag filter may start a run for some malformed numeric-looking tags, but the publish script rejects them before npm operations.
