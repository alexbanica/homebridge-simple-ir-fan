# Node 22 Publish Compatibility

Status: Approved

## Purpose

Keep Forgejo package publishing on a Node.js version supported by the plugin and its installed Homebridge libraries, while avoiding npm's deprecated `always-auth` configuration warning.

## Requested Behavior

- Run the Forgejo npm publish job with Node.js 22 instead of Node.js 24.
- Configure the job with `actions/setup-node@v6` instead of `actions/setup-node@v4`.
- Install public dependencies directly from the npm registry instead of the authenticated Forgejo publish registry.
- Preserve the existing Forgejo registry and token-based authentication behavior.

## Scope

- The Node.js setup step in `.github/workflows/publish.yml`.
- The deterministic workflow-structure assertion in `test/publishWorkflow.test.ts`.
- Completed-work spec and plan artifacts.

## Out Of Scope

- Upgrading `homebridge-lib`, `hb-lib-tools`, Homebridge, npm, or other dependencies.
- Changing package engine declarations, release tags, package contents, registry URLs, authentication secrets, or publish-script behavior.
- Running a real Forgejo package publication.

## Inputs And Constraints

- `homebridge-lib@7.1.8` and `hb-lib-tools@2.2.9` declare Node.js 20 and 22 support, but not Node.js 24 support.
- The package itself declares Node.js 22 support.
- `actions/setup-node@v6` must continue creating registry authentication configuration from `registry-url` and `NODE_AUTH_TOKEN` without writing the deprecated `always-auth` setting.
- `npm ci` must explicitly select `https://registry.npmjs.org/` so it does not request public dependency tarballs anonymously from Forgejo.
- `NODE_AUTH_TOKEN` must remain absent from the dependency-install step and scoped only to the publish step.
- The workflow must continue using the existing `ubuntu-slim` runner and read-only repository permissions.

## Deterministic Behavior Delivered

1. The publish job installs Node.js 22.
2. The setup step uses `actions/setup-node@v6`.
3. Registry authentication remains configured for the existing Forgejo npm endpoint.
4. Public dependencies install from `https://registry.npmjs.org/` without exposing the Forgejo package token to install scripts.
5. The workflow test fails if the setup action, Node.js version, or dependency registry regresses from the delivered values.

## Assumptions

- The hosted runner supports `actions/setup-node@v6` and Node.js 22.
- Node.js 22 is the least disruptive supported runtime because it does not require a Homebridge library migration.

## Impact

Future publish jobs no longer request an unsupported Node.js runtime for the installed Homebridge libraries, setup-node no longer generates npm's deprecated `always-auth` setting, and dependency installation no longer fails with an anonymous Forgejo `401 Unauthorized` response.

## Validation Performed

- Test-first failure confirmed that the updated assertion rejected the previous Node.js 24 and setup-node v4 workflow.
- A second test-first failure confirmed that dependency installation still used the Forgejo-configured job registry before the explicit npm registry was added.
- `npm test`: passed, 72 tests after implementation.
- `git diff --check`: passed.

## Validation Skipped

- Hosted GitHub Actions execution.
- Live Forgejo authentication and package publication.
- Separate `npm run build`, `npm run lint`, and `npm run prepublishOnly` commands because the `super-agent` workflow limits validation to commands expected to complete within 10 seconds.
- Independent QA and code review, as required by the `super-agent` workflow.

## Documentation Changes

No user-facing documentation changed because package installation, configuration, and release-tag behavior are unchanged.
