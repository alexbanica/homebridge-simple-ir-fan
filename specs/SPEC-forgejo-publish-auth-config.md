# Forgejo Publish Authentication Configuration

Status: Approved

## Purpose

Make the existing Forgejo release command authenticate reliably when npm is
given `NODE_AUTH_TOKEN`, including in the GitHub Actions publish job and during
the documented local release flow.

## Requested Behavior

- Configure npm with the exact Forgejo registry-scoped `_authToken` key before
  publishing.
- Keep the raw token in the publish subprocess environment rather than writing
  it to disk.
- Expose both the token and authentication configuration only to `npm publish`.
- Remove temporary authentication state after successful and failed publishes.
- Preserve the existing registry, package version, dist-tag, tarball validation,
  and post-publish verification behavior.

## Scope

- `scripts/publish-forgejo.mjs`
- `test/publishForgejoPackage.test.ts`
- Completed-work spec and plan artifacts for this fix.

## Out Of Scope

- Changing the Forgejo package token or GitHub Actions secret.
- Changing the publish workflow, release-tag contract, registry URL, package
  contents, or supported Node.js versions.
- Publishing, deleting, or otherwise mutating a live Forgejo package.

## Definitions

- **Authentication configuration:** A temporary npm user-config file containing
  the Forgejo registry URI fragment mapped to the literal
  `${NODE_AUTH_TOKEN}` environment-variable reference.

## Inputs And Constraints

- Forgejo npm authentication requires the scheme-less registry-specific key
  `//forgejo.alexlab.nl/api/packages/public/npm/:_authToken`.
- `NODE_AUTH_TOKEN` remains required before release work begins.
- Validation, build, and package-verification subprocesses must not receive the
  token or the temporary npm user-config path.
- The temporary file must be permission mode `0600` and must be cleaned up even
  when npm fails.

## Deterministic Behavior Delivered

1. The release script creates a unique temporary directory outside the checkout.
2. It writes a mode-`0600` `.npmrc` containing only the registry-scoped literal
   token reference.
3. The script supplies `NODE_AUTH_TOKEN` and `NPM_CONFIG_USERCONFIG` only to the
   `npm publish` subprocess.
4. The temporary directory and `.npmrc` are removed in a `finally` block after
   both successful and failed publication attempts.
5. All other npm subprocesses continue with authentication variables removed.

## Assumptions

- npm resolves `${NODE_AUTH_TOKEN}` in its user configuration using the publish
  subprocess environment.
- The configured Forgejo token has the package-write permission required by the
  existing release documentation.

## Impact

The publish command now sends the configured token to the Forgejo package
registry instead of failing with `ENEEDAUTH` because npm cannot find a scoped
authentication mapping.

## Validation Performed

- Full `npm test`: 72 tests passed.
- Changed-file ESLint check passed.
- `npm run build` passed.
- `git diff --check` passed.

## Validation Skipped

- Live Forgejo authentication, publication, and post-publication package lookup.
- `npm run prepublishOnly`, because it duplicates lint and build and the full
  repository lint has an unrelated pre-existing CRLF failure.

## Documentation Changes

No user documentation changed. The existing README already documents the
`NODE_AUTH_TOKEN`-only release interface; this fix makes that interface work as
documented.
