# Publish Node Matrix

Status: Approved

## Purpose

Run the Forgejo package publish job with the same Node.js version matrix as the build workflow.

## Requested Behavior

- Execute the publish job on Node.js 18.x, 20.x, and 22.x.
- Allow every matrix leg to complete independently when another leg fails.
- Preserve the existing tag trigger, runner, registry, authentication, install, and publish behavior.

## Scope

- `.github/workflows/publish.yml`
- `test/publishWorkflow.test.ts`
- Completed-work spec and plan artifacts.

## Out Of Scope

- Changing the build workflow matrix.
- Changing package engine declarations or dependencies.
- Changing the publish script or making concurrent publication idempotent.
- Running a real Forgejo publication.

## Inputs And Constraints

- The required matrix is exactly `18.x`, `20.x`, and `22.x`, matching `.github/workflows/build.yml`.
- Each matrix leg retains the existing `ubuntu-slim` runner and `actions/setup-node@v6` setup.
- Registry authentication remains scoped to the publish step.

## Deterministic Behavior Delivered

1. A matching numeric release tag creates three publish-job executions.
2. Each execution installs its assigned Node.js version from the 18.x, 20.x, and 22.x matrix.
3. `fail-fast: false` allows all three executions to report their result.
4. Each execution installs dependencies, builds, packs, publishes, and verifies the same release tag through the existing publish script.

## Assumptions

- The explicit request to publish with all three versions accepts that every matrix leg invokes a real package publication.
- Test-first development is not applicable because this is workflow configuration with an existing deterministic structural test.

## Impact

Forgejo release tags now exercise the complete publish process under Node.js 18.x, 20.x, and 22.x instead of Node.js 22 alone.

## Validation Performed

- Targeted compiled publish-workflow test.
- `git diff --check`.
- Staged path and staged diff inspection.

## Validation Skipped

- Full test, lint, build, and prepublish commands because the `super-agent` workflow permits only validation expected to complete within 10 seconds.
- Hosted workflow execution and live Forgejo publication.
- Independent QA and code review, as required by the `super-agent` workflow.

## Documentation Changes

No user-facing documentation changed because this only changes release automation.

## Residual Risk

- Node.js 18 is outside the package's declared `engines.node` range and outside the stated support range in the preceding Node 22 publish compatibility spec.
- All three jobs publish the same immutable package version. Forgejo may accept only the first publication and reject the remaining matrix legs, so hosted validation is required.
