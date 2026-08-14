# Single Node 22 Publish

Status: Approved

## Purpose

Publish each Forgejo npm package version exactly once using Node.js 22.

## Requested Behavior

- Remove the job strategy and Node.js matrix from the publish workflow.
- Configure the publish job with the literal Node.js version 22.
- Preserve existing release triggers, runner, registry, authentication, install, and publish behavior.

## Scope

- `.github/workflows/publish.yml`
- `test/publishWorkflow.test.ts`
- Completed-work spec and plan artifacts.

## Out Of Scope

- Changing `.github/workflows/build.yml` or its compatibility matrix.
- Changing supported engine declarations, dependencies, release tags, registry URLs, or publish-script behavior.
- Running a real Forgejo publication.

## Inputs And Constraints

- npm package identity is the unique package name and version, so the publish workflow must not attempt multiple uploads for the same release tag.
- Node.js 22 remains supported by the package and its installed Homebridge libraries.
- Forgejo authentication remains scoped to the publish step through `NODE_AUTH_TOKEN`.

## Deterministic Behavior Delivered

1. A matching numeric release tag creates one publish job.
2. The job installs Node.js 22 through `actions/setup-node@v6`.
3. The job installs dependencies, builds, packs, publishes, and verifies the release through the existing publish script exactly once.
4. The structural test rejects a future publish-job matrix or matrix-based Node version.

## Assumptions

- Compatibility across multiple Node.js versions remains the responsibility of the separate build workflow.
- Test-first development is not applicable because this is workflow configuration with an existing deterministic structural test.

## Impact

Release tags no longer create competing attempts to publish the same immutable npm package version.

## Validation Performed

- TypeScript test compilation.
- Focused publish-workflow test.
- `git diff --check`.
- Staged path and staged diff inspection.

## Validation Skipped

- Full test, lint, build, and prepublish commands because the `super-agent` workflow permits only validation expected to complete within 10 seconds.
- Hosted workflow execution and live Forgejo publication.
- Independent QA and code review, as required by the `super-agent` workflow.

## Documentation Changes

No user-facing documentation changed because this only changes release automation.

## Residual Risk

The hosted workflow and live Forgejo authentication remain unverified until a new numeric release tag runs the workflow.
