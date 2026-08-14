# SPEC-002 - Forgejo npm Tag Publishing

Status: Approved
Date: 2026-08-14

## Purpose

Publish deterministic, installable npm packages for
`homebridge-simple-ir-fan` to the public `public` organization on the Forgejo
instance at `https://forgejo.alexlab.nl` whenever an authorized maintainer
pushes a valid release tag to GitHub.

Provide the same release behavior through a local npm command so the package
contract can be validated without reproducing GitHub Actions internals.

## Problem

The repository currently builds and lints on generic pushes and pull requests,
but it has no release-tag policy, package creation command, Forgejo registry
configuration, publishing credentials, or publish job.

The package is marked `private`, its checked-in version is fixed at `1.0.0`,
and the current build workflow includes a dependency mutation step. These
conditions prevent a deterministic tag-derived package from being published
as-is.

The live Forgejo endpoint also currently presents only the leaf
`*.alexlab.nl` certificate. Standard TLS verification fails because the
Sectigo intermediate certificate is not served. A release runner must never
work around this by disabling TLS verification.

## Scope

In scope:

- Add an npm release command named `publish:forgejo`.
- Allow `homebridge-simple-ir-fan` to be packaged and published.
- Derive the npm package version from an explicit release-tag environment
  input.
- Create one npm tarball from the validated, built checkout and publish that
  exact tarball.
- Publish the existing unscoped package name `homebridge-simple-ir-fan` to
  `https://forgejo.alexlab.nl/api/packages/public/npm/`.
- Add GitHub Actions behavior for valid stable release tags.
- Keep registry credentials secret and scoped to the publish operation.
- Constrain package contents to the runtime plugin and required package
  metadata/documentation.
- Document release usage, GitHub configuration, Forgejo configuration, TLS
  prerequisites, and first-release verification.

Out of scope:

- Publishing to npmjs, GitHub Packages, or another registry.
- Changing the package name to a scoped name such as
  `@public/homebridge-simple-ir-fan`.
- Prerelease or build-metadata versions.
- Creating GitHub Releases or uploading GitHub Actions artifacts.
- Automatically creating, moving, deleting, or force-updating Git tags.
- Deleting or overwriting an existing Forgejo package version.
- Publishing from pull requests, branch pushes, scheduled runs, or manual
  workflow dispatch.
- Changing the plugin's runtime, Homebridge, HomeKit, fan, reset, rotation, or
  configuration-schema behavior.
- Publishing provenance attestations or signing package tarballs.
- Replacing the initial token-based authentication with GitHub OIDC and a
  Forgejo Authorized Integration.
- Refactoring the existing general CI matrix, including its Node 18 entry and
  dependency-audit behavior, except where release isolation is required.

## Definitions

- **Release tag:** A Git tag whose complete name matches
  `vMAJOR.MINOR.PATCH`, where each component is a non-negative decimal integer
  without a leading zero unless the component is exactly `0`.
- **Release version:** The release tag after removing its single leading `v`.
- **Release-tag input:** The `RELEASE_TAG` environment variable consumed by
  the npm release command.
- **Registry:**
  `https://forgejo.alexlab.nl/api/packages/public/npm/`.
- **Package owner:** The live Forgejo organization named `public`.
- **Publish token:** A Forgejo access token owned by an account permitted to
  publish packages for the `public` organization.
- **Publish command:** `npm run publish:forgejo`.
- **Release checkout:** The exact commit referenced by the pushed release tag.

## Inputs And Constraints

### Release tag and version

- `RELEASE_TAG` is required and is the only source of the release version.
- The value must match the release-tag definition exactly. Whitespace, missing
  `v`, extra prefixes or suffixes, prerelease identifiers, and build metadata
  are rejected before packaging or network access.
- Examples:
  - accepted: `v0.1.0`, `v1.0.0`, `v12.34.56`;
  - rejected: `1.0.0`, `release-v1.0.0`, `v01.0.0`, `v1.0`,
    `v1.0.0-beta.1`, `v1.0.0+build.1`.
- The package version written into the release checkout must equal the release
  version exactly in both `package.json` and the package-lock root metadata.
- Version preparation in CI is ephemeral. Publishing must not create a version
  commit, create another Git tag, push changed manifests, or alter the commit
  referenced by the release tag.

### Package identity and contents

- The published npm name remains `homebridge-simple-ir-fan`.
- The package must not remain npm-private.
- Registry ownership is selected by the registry URL; the unscoped package
  name does not need to match the Forgejo organization name.
- The package tarball must contain the compiled `dist` runtime, `package.json`,
  `config.schema.json`, `README.md`, and license material needed to identify
  and run the Homebridge plugin.
- The tarball must exclude source, tests, local configuration, GitHub workflow
  files, agent artifacts, specs, plans, local runtime state, secrets,
  development-only configuration, and previously created tarballs.
- The packed manifest's name and version and the tarball filename must agree
  with the derived release version.

### Authentication and secret handling

- Publishing uses token authentication over verified HTTPS.
- The token must not be committed, placed in package metadata, supplied as a
  command-line argument, or printed in workflow logs.
- GitHub stores the token as an Actions secret named
  `FORGEJO_PACKAGE_TOKEN`.
- The workflow exposes that secret as npm's `NODE_AUTH_TOKEN` only to the
  publish operation.
- Ordinary build, test, lint, pack-inspection, branch-push, and pull-request
  jobs must not receive the token.
- The GitHub workflow requires only read access to repository contents. The
  GitHub-provided token is not used to authenticate to Forgejo.

### Forgejo ownership and visibility

- The token owner must be a member of the `public` organization with the
  organization access required to write packages.
- The token must use the narrow `write:package` scope and the `Public only`
  resource restriction unless live Forgejo behavior proves that this
  least-privilege combination cannot publish to the public organization.
- A broader token is not an automatic fallback; any required expansion must be
  reported and approved.
- Package read visibility is inherited from the public visibility of the
  `public` organization and the instance-wide Forgejo access policy.

### TLS and runner connectivity

- `forgejo.alexlab.nl` must pass standard hostname and certificate-chain
  verification before publishing is enabled.
- The preferred correction is for the Forgejo nginx endpoint to serve the full
  publicly trusted certificate chain, including the Sectigo intermediate CA.
- The workflow and npm configuration must not use `curl -k`,
  `NODE_TLS_REJECT_UNAUTHORIZED=0`, npm `strict-ssl=false`, or an equivalent
  verification bypass.
- A self-hosted runner additionally requires DNS resolution and outbound TCP
  443 access to `forgejo.alexlab.nl` and the dependency sources used by npm.
- A GitHub-hosted `ubuntu-latest` runner requires no persistent runner
  customization after the public certificate chain is corrected.

## Deterministic Behavior

### Local npm release command

1. The publish command validates all required environment and tag inputs before
   changing package metadata, building, packing, or contacting Forgejo.
2. Missing or invalid `RELEASE_TAG` fails with a secret-safe, actionable error.
3. Missing publish authentication fails before the publish request.
4. The command derives the release version by removing exactly one leading `v`.
5. It updates the release checkout's package and lockfile root versions without
   committing or tagging.
6. It runs the repository's deterministic tests and publish validation. Any
   test, lint, or build failure stops the release.
7. It creates one tarball and verifies the packed package identity and allowed
   contents before any publish request.
8. It publishes that exact tarball to the fixed Forgejo registry.
9. Stable versions are assigned the npm dist-tag `latest`.
10. A publish conflict because the same package name and version already exists
    fails without deleting or replacing the existing version.
11. Any failure returns a non-zero status and does not claim that a package was
    published.

### GitHub Actions release behavior

1. Ordinary branch pushes and pull requests retain build-and-lint behavior and
   never publish.
2. A pushed tag is considered for publishing only when its name starts with
   `v`; the release command remains the authoritative strict validator.
3. The publish job checks out the exact tagged commit and receives the short
   GitHub tag name through `RELEASE_TAG`. GitHub's `GITHUB_REF_NAME` or
   equivalent `github.ref_name` value is the source.
4. The release job uses Node 24, which is inside the package's declared engine
   range, and performs a clean lockfile-based dependency install.
5. Release validation and packaging run in a clean job that does not run or
   inherit the existing dependency-mutating `npm audit fix` step.
6. Publishing starts only after all release validation succeeds.
7. The workflow limits GitHub permissions to `contents: read` and makes the
   Forgejo secret available only for the publish operation.
8. Concurrent processing of the same release tag is serialized. A rerun after
   successful publication fails safely at the duplicate-version boundary.
9. Workflow logs may show the registry, package name, version, and verification
   results, but never the token or generated npm authentication configuration.

### Published-package verification

- After a successful publish response, the workflow queries the fixed registry
  for `homebridge-simple-ir-fan@RELEASE_VERSION`.
- Verification must confirm the published name, version, `latest` dist-tag, and
  tarball availability.
- If publication succeeds but verification fails, the run fails and reports
  that the registry may contain the new immutable version; it must not retry by
  deleting or overwriting the package.

## GitHub And Forgejo Configuration Contract

Before the first release tag is pushed, the operator must configure:

- A dedicated Forgejo service account or narrowly scoped maintainer identity
  that is a member of the `public` organization with package-write access.
- A Forgejo access token for that identity with `write:package` and `Public
  only` restrictions.
- The token value as the GitHub repository Actions secret
  `FORGEJO_PACKAGE_TOKEN`.
- A GitHub tag ruleset or equivalent repository policy limiting creation and
  update of tags matching `v*` to trusted release maintainers.
- A complete certificate chain at the Forgejo nginx TLS endpoint.

No Forgejo username or password, npmrc file, token file, or permanent registry
configuration is required on a GitHub-hosted runner. A self-hosted runner needs
only standard Node/npm prerequisites, network reachability, and standard CA
trust after the server chain is corrected.

## Assumptions

- The requested “public organization” is the live Forgejo organization whose
  exact name is `public`.
- Releases initially need stable semantic versions only.
- The package remains unscoped for compatibility with its existing Homebridge
  plugin identifier.
- `latest` is the intended dist-tag for every accepted release.
- GitHub Actions, rather than Forgejo Actions, performs the release.
- Static token authentication is acceptable for the initial workflow; OIDC may
  be specified separately later.
- Actual release-tag creation and the first production publish remain
  operator-owned actions.

## Regression Impact

- Plugin runtime and Homebridge behavior are unchanged.
- Branch and pull-request workflows must never gain Forgejo credentials or a
  publish side effect.
- Existing package consumers continue to use the same package name.
- Removing npm-private status makes accidental publication possible if a
  maintainer directly invokes npm publishing outside the documented command;
  the fixed publish registry and documented command must constrain that risk.
- The existing Node 18 CI mismatch and dependency-mutating audit step remain
  visible technical debt but are not part of the isolated release job.
- A malformed or duplicate tag can produce a failed workflow but cannot replace
  an existing package version.

## Validation Plan

Deterministic repository validation:

- Run `npm test`.
- Run `npm run lint` and distinguish any unchanged baseline line-ending errors
  from new failures.
- Run `npm run build`.
- Run `npm run prepublishOnly`.
- Exercise the release command without network publication for missing input,
  malformed tags, accepted tag-to-version conversion, lockfile alignment,
  package identity, and exact allowlisted tarball contents.
- Validate GitHub Actions YAML syntax and confirm the publish path is reachable
  only from tag pushes.
- Confirm the publish job has `contents: read`, uses a clean install, does not
  run `npm audit fix`, and scopes `FORGEJO_PACKAGE_TOKEN` to publishing.
- Run `git diff --check`.

External preflight validation:

- Verify normal TLS validation succeeds for
  `https://forgejo.alexlab.nl/api/v1/version` without an insecure bypass.
- Verify the `public` organization remains public.
- Verify the token identity has package-write access without logging the token.

Operational acceptance:

- Push one new valid release tag through the trusted maintainer path.
- Confirm validation, package creation, publication, and post-publish lookup all
  succeed.
- Install the exact published version from the public Forgejo registry in a
  clean environment and confirm its package metadata and compiled Homebridge
  entrypoint are present.
- Until this real tag-triggered round trip succeeds, delivery remains DRAFT
  even when all deterministic checks pass.

## Documentation Needs

- Document the supported tag format and version derivation.
- Document `npm run publish:forgejo`, its required environment contract, and
  that normal local development does not need Forgejo credentials.
- Document the fixed registry URL and public installation command.
- Document how to create the least-privilege Forgejo token and add the masked
  GitHub Actions secret without showing a real credential.
- Document the TLS full-chain prerequisite and explicitly prohibit insecure
  workarounds.
- Document duplicate-version behavior, first-release verification, and the
  DRAFT boundary when a live publish has not been performed.

## Approval Criteria

Approve this spec only if all of the following are intended:

- release tags use stable `vMAJOR.MINOR.PATCH` only;
- the npm package remains unscoped as `homebridge-simple-ir-fan`;
- the Forgejo owner is `public` and the registry is
  `https://forgejo.alexlab.nl/api/packages/public/npm/`;
- releases use the `latest` npm dist-tag;
- GitHub Actions uses a least-privilege Forgejo token stored as
  `FORGEJO_PACKAGE_TOKEN`;
- the server certificate chain is corrected instead of bypassing TLS checks;
- actual tag creation and the first live publish remain operator-owned.
