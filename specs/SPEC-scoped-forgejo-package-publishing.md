# Scoped Forgejo Package Publishing

Status: Approved

## Purpose

Restore the Forgejo release command after the package manifest was renamed to
`@alexlab/homebridge-simple-ir-fan`.

## Requested Behavior

- Accept the current scoped package name during release preparation.
- Pack, publish, and verify the scoped package using npm's actual scoped-package
  metadata and filename conventions.
- Keep the lockfile and documented Forgejo install commands aligned with the
  package manifest.

## Scope

- `scripts/publish-forgejo.mjs`
- `test/publishForgejoPackage.test.ts`
- `package-lock.json`
- Forgejo package identity examples in `README.md`
- Completed-work spec and plan artifacts for this fix

## Out Of Scope

- Publishing or deleting a live Forgejo package.
- Changing the package scope, registry URL, release tags, authentication, build,
  packaged contents, or Homebridge runtime behavior.
- Renaming the Git repository or Homebridge platform identifier.

## Definitions

- **Package name:** `@alexlab/homebridge-simple-ir-fan`, used in the manifest,
  npm pack metadata, publish verification, and npm package specifications.
- **Packed filename:** `alexlab-homebridge-simple-ir-fan-VERSION.tgz`, emitted by
  npm when packing the scoped package.
- **Registry tarball basename:** `homebridge-simple-ir-fan-VERSION.tgz`, used at
  the end of the published tarball URL.

## Inputs And Constraints

- The current `package.json` name is authoritative.
- The release command must retain its existing exact-name safety guard.
- npm's scoped pack filename and registry tarball basename are intentionally not
  identical to the manifest package name.
- Existing publish authentication isolation and cleanup behavior must remain
  unchanged.

## Deterministic Behavior Delivered

1. Release preparation accepts only `@alexlab/homebridge-simple-ir-fan`.
2. Pack metadata selection requires that exact scoped package name.
3. The publish command requires and cleans up npm's scope-stripped packed
   filename, `alexlab-homebridge-simple-ir-fan-VERSION.tgz`.
4. Post-publish lookup requests `@alexlab/homebridge-simple-ir-fan@VERSION` and
   requires the returned name to match exactly.
5. Published tarball validation retains npm's unscoped tarball basename.
6. The root lockfile identity and Forgejo install documentation use the scoped
   package name.

## Assumptions

- The preceding package-name commit intentionally established the `@alexlab`
  scope.
- Forgejo accepts scoped npm packages through the already-configured registry
  endpoint.

## Impact

`npm run publish:forgejo` no longer rejects the repository's current manifest
name and continues through the release pipeline with consistent scoped-package
identity checks.

## Validation Performed

- `npm test`: passed, 73 tests.
- Changed-file ESLint: passed.
- `npm run build`: passed.
- `npm pack --json --dry-run --ignore-scripts` with a writable temporary npm
  cache: passed and reported the expected scoped name and packed filename.
- `git diff --check`: passed before artifact creation and is rerun during final
  staging reconciliation.

## Validation Skipped

- Live Forgejo publication, authentication, and post-publication lookup were not
  run because this invocation did not authorize publishing a package.
- `npm run prepublishOnly` was not run because its lint and build components are
  covered by changed-file lint and the successful build; full repository lint
  retains the previously documented unrelated CRLF baseline.

## Documentation Changes

The README Forgejo package name and exact-version/beta install examples now use
the `@alexlab` scope. This completed-work spec and its plan document the fix.
