# Numeric Release Tags

Status: Approved

## Purpose

Allow the Forgejo npm publishing workflow to release from numeric Git tags without a leading `v`, including stable and beta package versions.

## Requested Behavior

- Accept stable release tags such as `1.0.0`.
- Accept beta release tags such as `1.0.0-beta1`.
- Do not require or accept a leading `v`.

## Scope

- GitHub Actions publish tag filtering.
- Exact release-tag validation and npm version selection.
- npm dist-tag selection and post-publish verification.
- Deterministic tests and release documentation for the changed contract.

## Out Of Scope

- Creating, moving, or deleting Git tags.
- Publishing a real package.
- Changing the Forgejo registry, authentication, runner, or package contents.
- Supporting arbitrary semantic-version prerelease identifiers or build metadata.

## Definitions

- Stable tag: `MAJOR.MINOR.PATCH`, where each component is zero or a positive integer without leading zeroes.
- Beta tag: `MAJOR.MINOR.PATCH-betaN`, where `N` is a positive integer without leading zeroes.
- Numeric release tag filter: the GitHub Actions coarse filter `[0-9]*.[0-9]*.[0-9]*`; exact validation remains owned by the publish script.

## Inputs And Constraints

- `RELEASE_TAG` is supplied unchanged from `github.ref_name`.
- The accepted Git tag is also the exact npm package version.
- Stable releases must use the npm `latest` dist-tag.
- Beta releases must use the npm `beta` dist-tag so a prerelease cannot replace the normal stable install target.
- Unsupported forms, including leading `v`, whitespace, leading zeroes, `beta0`, dotted prereleases, arbitrary suffixes, and build metadata, must fail before npm is invoked.

## Deterministic Behavior Delivered

1. A pushed numeric-looking tag starts the publish workflow.
2. The publish script accepts only the stable and beta formats defined above.
3. The script writes the exact accepted tag into `package.json` and `package-lock.json` in its release checkout.
4. Stable tarballs publish with `--tag latest`; beta tarballs publish with `--tag beta`.
5. Post-publish verification checks the corresponding dist-tag, exact package version, package name, and tarball URL.
6. Legacy `vMAJOR.MINOR.PATCH` tags are rejected.

## Assumptions

- `betaN` means a positive beta sequence number, beginning with `beta1`.
- A coarse workflow filter is acceptable because the publish script performs the security-relevant exact validation.

## Impact

Maintainers can publish with tags such as `1.0.0` and `1.0.0-beta1`. Existing `v*` release tags no longer start this workflow and are rejected by direct script invocation.

## Validation Performed

- `npm test`: passed, 72 tests.
- The suite covers stable and beta acceptance, legacy and malformed rejection, dist-tag selection, post-publish verification, and workflow structure.

## Validation Skipped

- Real GitHub Actions tag-trigger execution.
- Real Forgejo authentication, publish, and install verification.
- Independent QA and code review, as required by the `super-agent` workflow.

## Documentation Changes

`README.md` now documents stable and beta tag formats, npm dist-tag behavior, the updated local release command, and a beta install example.
