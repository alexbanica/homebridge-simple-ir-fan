# Node 24 GitHub Actions

Status: Approved

## Purpose

Remove GitHub Actions Node.js 20 deprecation warnings by using current official
action releases whose action runtimes target Node.js 24.

## Requested Behavior

- Use `actions/checkout@v7` in every repository workflow.
- Use `actions/setup-node@v6` in every workflow that configures Node.js.
- Preserve the application Node.js versions selected by each workflow.
- Add deterministic coverage that rejects the superseded Node.js 20-based action
  releases.

## Scope

- `.github/workflows/build.yml`
- `.github/workflows/publish.yml`
- `test/publishWorkflow.test.ts`
- Completed-work spec and plan artifacts for this update.

## Out Of Scope

- Changing the build matrix or the publish job's selected application runtime.
- Changing workflow triggers, permissions, runners, registry authentication,
  release behavior, dependencies, or application code.
- Running hosted GitHub Actions jobs or publishing a package.

## Definitions

- **Action runtime:** The Node.js version embedded by GitHub to execute a
  JavaScript action. It is independent from the application Node.js version
  selected through `actions/setup-node`.

## Inputs And Constraints

- `actions/checkout@v7` declares the Node.js 24 action runtime.
- `actions/setup-node@v6` declares the Node.js 24 action runtime.
- The build matrix remains Node.js 18.x, 20.x, and 22.x for application
  compatibility testing.
- The Forgejo publish job continues selecting Node.js 22 for the plugin release.
- Existing Forgejo authentication behavior must remain unchanged.

## Deterministic Behavior Delivered

1. The build workflow checks out source with `actions/checkout@v7` and configures
   each matrix runtime with `actions/setup-node@v6`.
2. The publish workflow checks out the exact release tag with
   `actions/checkout@v7` and retains `actions/setup-node@v6` with Node.js 22.
3. Structural tests require checkout v7 in both workflows, reject checkout
   v4-v6, require setup-node v6, and reject setup-node v4 in the build workflow.

## Assumptions

- GitHub-hosted `ubuntu-latest` and `ubuntu-slim` runners meet the runner-version
  requirements of the selected official actions.
- No workflow uses an action reference outside `.github/workflows`.

## Impact

GitHub no longer needs to force Node.js 20-based checkout or setup actions to run
under Node.js 24, eliminating the reported deprecation warning while preserving
the workflows' selected application runtimes.

## Validation Performed

- Focused publish-workflow tests: 5 passed.
- Full `npm test`: 73 tests passed.
- Changed-file ESLint check passed.
- Both workflow files parsed successfully as YAML through `js-yaml`.
- `git diff --check` passed.

## Validation Skipped

- Hosted GitHub Actions build and publish executions.
- Live Forgejo authentication and publication.
- Application build and full repository lint because this change only updates
  workflow action references and deterministic structural coverage.

## Documentation Changes

No user-facing documentation changed. The workflows remain operationally
equivalent apart from their official action runtime versions.
