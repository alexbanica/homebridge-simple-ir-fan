# Scoped Forgejo Package Publishing Completed Plan

Status: Approved

## Spec Reference

`specs/SPEC-scoped-forgejo-package-publishing.md`

## Affected Files

- `scripts/publish-forgejo.mjs`
- `test/publishForgejoPackage.test.ts`
- `package-lock.json`
- `README.md`
- `specs/SPEC-scoped-forgejo-package-publishing.md`
- `specs/PLAN-scoped-forgejo-package-publishing.md`

## Implementation Steps Performed

1. Confirmed that the package rename changed only `package.json`, leaving the
   publisher, lockfile, tests, and documentation on the previous identity.
2. Verified npm's scoped pack metadata and packed filename with a dry run.
3. Updated the release fixture to model the scoped manifest/view name, local
   packed filename, and registry tarball basename separately.
4. Updated the publisher's exact-name guard, pack selection, packed filename,
   cleanup path, package lookup, and published metadata checks.
5. Aligned the root lockfile identity and Forgejo README examples.
6. Ran the short deterministic validation allowed by the super-agent workflow.

## Validation Run

- `npm test`: passed, 73 tests.
- `./node_modules/.bin/eslint scripts/publish-forgejo.mjs test/publishForgejoPackage.test.ts --max-warnings=0`: passed.
- `npm run build`: passed.
- `npm_config_cache=/tmp/homebridge-simple-ir-fan-npm-cache npm pack --json --dry-run --ignore-scripts`: passed.
- `git diff --check`: passed before artifact creation and is rerun during final
  staging reconciliation.

## Validation Skipped Or Blocked

- Live Forgejo publication, authentication, and package lookup: skipped because
  publishing was not authorized and no release token was used.
- `npm run prepublishOnly`: skipped because it repeats lint and build; the full
  repository lint has a previously documented unrelated CRLF baseline.
- The first npm pack dry run could not use the sandbox's read-only default npm
  cache; the same command passed with its cache redirected to `/tmp`.

## QA Skipped

An independent QA phase was skipped as required by the `super-agent` workflow.

## Code Review Skipped

Independent code review was skipped as required by the `super-agent` workflow.

## Documentation Updates

The Forgejo publishing and install examples in `README.md` now name the scoped
package. The completed-work spec and plan were added under `specs/`.

## Staging Status

All accepted in-scope paths are staged together. No unrelated path is staged.

## Commit Status

Not committed; the user did not request a commit.

## Push Status

Not pushed; the user did not request a push.

## Residual Risk

The deterministic tests and npm dry run model the scoped package correctly, but
only a trusted release using the real Forgejo token can validate live scoped
publication and lookup. Delivery therefore remains DRAFT.
