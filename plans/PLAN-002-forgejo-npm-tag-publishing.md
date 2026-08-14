# PLAN-002 - Forgejo npm Tag Publishing

Status: Approved
Date: 2026-08-14

## Approved Spec

- `specs/SPEC-002-forgejo-npm-tag-publishing.md`
- Status verified as `Approved` on 2026-08-14.

## Objective

Implement the approved stable-tag npm release contract for the public Forgejo
organization, add deterministic test coverage for tag/version/package and
workflow security behavior, document the operator configuration, and deliver
every accepted repository change on an isolated branch.

The implementation must not create a release tag or publish a production
package. The first tag-triggered publish remains operator-owned, so repository
delivery remains DRAFT until that round trip succeeds.

## Implementation Context Boundary

- Implementation starts only in a fresh session, after context is cleared, or
  after the user explicitly confirms same-context implementation for that
  invocation.
- Load only applicable instructions, the approved spec and this approved plan,
  branch/worktree state, the files named below, and minimal neighboring test or
  npm-script patterns.
- Do not repeat product, architecture, package-registry, CI-platform, or release
  design research during implementation.
- Treat the registry URL, owner, package name, stable tag format, token name,
  and operator-owned acceptance boundary as fixed approved inputs.
- Stop for an artifact amendment if implementation requires prerelease tags,
  package scoping, another registry, broader Forgejo credentials, disabled TLS
  verification, a live publish, or materially different behavior.
- No architecture agent is planned: the change is isolated release tooling and
  workflow wiring with no plugin-runtime or domain-architecture coupling.

## Branch And Worktree Policy

- Delivery branch: `feature/forgejo-npm-tag-publishing`.
- Expected base: `origin/latest` at
  `00bed289f19ab83e4d79e1858b9ac08f6b54121a`.
- Implementation worktree slug: `forgejo-npm-tag-publishing`.
- Implementation worktree path:
  `.worktrees/forgejo-npm-tag-publishing` inside the repository.
- The invoking checkout remains the planning checkout and must not be used for
  task implementation edits.
- At implementation start, fetch `origin` and verify that `origin/latest` still
  resolves to the expected base. Stop rather than silently rebasing or choosing
  a new base if it has moved.
- Verify that neither the local nor remote delivery branch already exists. Stop
  on a conflicting branch rather than replacing it.
- Create the `.worktrees/` root when absent, ensure the repository-root
  `.gitignore` contains the exact entry `/.worktrees/`, and verify the task path
  is ignored before worktree creation.
- Create or reuse only the planned task worktree in detached-HEAD state at the
  expected base. A reused worktree must be detached at the expected base and
  clean before edits.
- Import the approved spec and plan into the implementation worktree verbatim;
  do not revise approved behavior during implementation.
- Defer creation of `feature/forgejo-npm-tag-publishing` until development has
  reached DRAFT delivery or the full repository-side Definition of Done.
- Workers must not create, switch, or manage branches or worktrees; commit,
  stage, push, or reset; or revert another unit's work.
- All agents are sharing the repository. Every assignment must preserve and
  accommodate changes made by other units.

## Final Intended Changes

### Approved artifacts and worktree exclusion

- `specs/SPEC-002-forgejo-npm-tag-publishing.md`: carry the approved behavior
  contract unchanged.
- `plans/PLAN-002-forgejo-npm-tag-publishing.md`: carry this approved execution
  contract unchanged.
- `.gitignore`: add `/.worktrees/` exactly once while preserving all existing
  ignore behavior.

### Release command and package contract

- Add `scripts/publish-forgejo.mjs` as the executable release boundary.
- Keep the release behavior isolated from `src`; no Homebridge runtime module
  may depend on or import release tooling.
- The script must:
  - require and strictly validate `RELEASE_TAG` as stable
    `vMAJOR.MINOR.PATCH`;
  - derive the exact version without `v`;
  - require `NODE_AUTH_TOKEN` without printing it;
  - update `package.json` and the root package-lock version ephemerally without
    creating a commit or tag;
  - run deterministic tests and publish validation with the authentication
    token removed from child-process environments;
  - create one npm tarball and parse npm's machine-readable pack output rather
    than guessing its filename;
  - validate packed name, version, filename, and allowlisted contents before
    network access;
  - publish that exact tarball to the fixed Forgejo registry with dist-tag
    `latest`;
  - verify the published version after success without logging credentials;
  - fail non-zero and never delete or overwrite an existing version.
- Subprocess execution must use argument arrays without shell interpolation so
  a tag or path cannot become executable shell input.
- Any temporary npm authentication configuration must be process-scoped,
  secret-safe, and removed on both success and failure. Do not add a tracked
  `.npmrc`.
- Update `package.json` to:
  - remove npm-private status;
  - add `publish:forgejo` invoking the release script;
  - pin publishing to
    `https://forgejo.alexlab.nl/api/packages/public/npm/`;
  - use a package-content allowlist containing the compiled runtime and required
    Homebridge schema material;
  - preserve the existing package name, checked-in version, Homebridge schema,
    dependencies, engines, and unrelated scripts.
- Preserve `package-lock.json` at the checked-in development version unless npm
  metadata synchronization proves a repository change is required. Tests must
  prove that an isolated release checkout updates its root version in parallel
  with `package.json`.
- Keep `.npmignore` unless the package-content allowlist makes a narrow cleanup
  necessary. Do not broaden cleanup into unrelated ignore-file refactoring.

### GitHub Actions release workflow

- Add `.github/workflows/publish.yml` rather than coupling credentials or
  release mutations to the existing dependency-audit matrix.
- Trigger only for pushed tags matching the coarse `v*` filter; retain strict
  semantic validation in the npm command.
- Configure `permissions: contents: read`.
- Serialize runs for the same tag without canceling an in-progress publish.
- Check out the tagged commit, use Node 24, configure the approved registry,
  and install dependencies with `npm ci` before any secret is exposed.
- Invoke `npm run publish:forgejo` with:
  - `RELEASE_TAG` sourced from `${{ github.ref_name }}`;
  - `NODE_AUTH_TOKEN` sourced from
    `${{ secrets.FORGEJO_PACKAGE_TOKEN }}`.
- Do not expose the Forgejo token to checkout, setup, install, ordinary CI,
  pull-request, branch-push, or dependency-audit steps.
- Do not add `npm audit fix`, insecure TLS settings, tag creation, manifest
  commits, force-push, package deletion, or retry-by-overwrite behavior.
- Preserve `.github/workflows/build.yml` unless a strictly necessary syntax or
  trigger interaction is demonstrated. The approved release path must remain a
  separate clean job/workflow.

### Deterministic tests

- Add `test/publishForgejoPackage.test.ts` covering the executable command with
  temporary fixture checkouts and fake npm subprocesses placed first on `PATH`.
- Cover at minimum:
  - missing `RELEASE_TAG`;
  - accepted stable tags and exact `v` removal;
  - every rejected tag class named by the approved spec;
  - missing authentication;
  - package and lockfile version alignment without Git commit/tag activity;
  - argument-array invocation and fixed registry/dist-tag values;
  - token removal from validation, test, pack-inspection, and verification
    subprocesses;
  - token availability only to the publish subprocess;
  - machine-readable tarball selection;
  - package-content allowlist rejection before publishing;
  - validation/build/pack/publish/verification failure propagation;
  - duplicate-version failure without an unpublish/delete attempt;
  - cleanup of temporary authentication state after success and failure.
- Add `test/publishWorkflow.test.ts` to assert the checked-in workflow contract:
  - tag-only `v*` trigger;
  - exact GitHub ref-to-environment mapping;
  - Node 24 and clean install;
  - `contents: read`;
  - same-tag concurrency without cancellation;
  - correct secret mapping;
  - absence of branch, pull-request, manual, scheduled, audit-fix, insecure TLS,
    tag mutation, deletion, and overwrite behavior;
  - separation from the existing general build workflow.
- Extend existing `npm test`; do not add a second test runner or call compiled
  TypeScript tests directly outside the repository script.

### Documentation

- Update `README.md` with:
  - the stable tag contract and version derivation;
  - `npm run publish:forgejo` and its environment contract;
  - the fixed public registry and exact-version installation example;
  - the Forgejo service-account/organization membership requirement;
  - a least-privilege `Public only`, `write:package` token;
  - GitHub repository secret `FORGEJO_PACKAGE_TOKEN`;
  - trusted-maintainer tag ruleset guidance;
  - the server full-chain TLS prerequisite and forbidden insecure bypasses;
  - immutable duplicate-version behavior;
  - operator-owned first-tag validation and DRAFT boundary.
- Use placeholders only; never add real usernames, tokens, passwords, npmrc
  content containing credentials, or machine-specific runner paths.

## Dependency-Aware Execution Graph

Every subagent assignment is capped at five minutes of active work. The main
agent supervises elapsed time, inspects all returned changes, and forcibly stops
an assignment at five minutes. A timed-out remainder must be split into smaller
non-overlapping units before reassignment to a new clean-context agent.

### T1 - Release command contract tests

- Type: test-first.
- Agent: clean-context `test-writer`.
- Ownership: `test/publishForgejoPackage.test.ts` only.
- Dependencies: none.
- Boundary: executable release input, versioning, subprocess, package,
  credential, cleanup, and failure behavior from the approved spec.
- Acceptance: deterministic failing tests describe the approved behavior
  without modifying production files or contacting a registry.
- Validation: `npm test`, with expected failures attributable only to missing
  production behavior.
- Maximum active time: five minutes.

### T2 - Publish workflow contract tests

- Type: test-first.
- Agent: clean-context `test-writer`.
- Ownership: `test/publishWorkflow.test.ts` only.
- Dependencies: none.
- Boundary: checked-in YAML trigger, permissions, Node/install, concurrency,
  secret scoping, command invocation, and prohibited release behavior.
- Acceptance: deterministic failing tests describe the approved workflow and
  do not parse or expose secrets.
- Validation: `npm test`, with expected failures attributable only to the absent
  publish workflow.
- Maximum active time: five minutes.

### D1 - Release command and package metadata

- Type: development.
- Agent: clean-context `developer`.
- Ownership: `scripts/publish-forgejo.mjs`, `package.json`, and only if strictly
  required `package-lock.json` or `.npmignore`.
- Dependencies: T1 complete.
- Boundary: implement the release executable, npm command, fixed registry, npm
  publish eligibility, and package allowlist; do not edit workflows, docs,
  plugin runtime, or tests.
- Acceptance: T1 passes; existing scripts and embedded Homebridge schema remain
  unchanged except approved package metadata; no live network publication is
  attempted.
- Validation: focused T1 execution through `npm test`, then
  `npm run prepublishOnly` and a secret-free `npm pack --dry-run --json` package
  inspection where possible.
- Maximum active time: five minutes.

### D2 - Tag-triggered GitHub workflow

- Type: development.
- Agent: clean-context `developer`.
- Ownership: `.github/workflows/publish.yml` only.
- Dependencies: T2 and D1 complete.
- Boundary: implement the isolated GitHub tag workflow against the final D1 npm
  command; do not edit the existing build workflow, package files, tests, or
  docs.
- Acceptance: T2 passes; the workflow exposes the secret only to the publish
  command and contains no insecure, mutating, deletion, or overwrite behavior.
- Validation: focused T2 execution through `npm test` plus available local YAML
  syntax validation.
- Maximum active time: five minutes.

### D3 - Release operator documentation

- Type: development, docs-only; test-first not applicable because this unit
  changes documentation rather than executable behavior.
- Agent: clean-context `developer`.
- Ownership: `README.md` only.
- Dependencies: D1 and D2 complete.
- Boundary: document final command/workflow behavior and external configuration
  without changing production or test files.
- Acceptance: every documentation requirement in this plan is present, commands
  match final files, and no secret or insecure TLS workaround appears.
- Validation: targeted text review and `git diff --check`.
- Maximum active time: five minutes.

### R1 - Release tooling review

- Type: independent code review.
- Agent: clean-context `code-reviewer`.
- Ownership: read-only review of T1 and D1 diffs.
- Dependencies: D1 complete.
- Boundary: approved tag/version/package contract, command injection, secret
  exposure, temporary-file cleanup, lifecycle recursion, failure propagation,
  package contents, and missing tests.
- Acceptance: report findings with severity and exact file/line evidence; do
  not implement fixes.
- Validation: inspect focused tests/results and relevant diff.
- Maximum active time: five minutes.

### R2 - Workflow and documentation review

- Type: independent code review.
- Agent: clean-context `code-reviewer`.
- Ownership: read-only review of T2, D2, and D3 diffs.
- Dependencies: D3 complete.
- Boundary: event trust, GitHub permissions, secret scoping, clean release
  isolation, concurrency, tag mapping, TLS guidance, and documentation accuracy.
- Acceptance: report findings with severity and exact file/line evidence; do
  not implement fixes.
- Validation: inspect focused tests/results and relevant diff.
- Maximum active time: five minutes.

### Finding-fix units

- Each actionable review or main-agent QA finding is assigned to a new
  clean-context `developer` agent.
- The assignment owns only the specific affected production/docs files and may
  use the relevant existing test as acceptance input; tests are changed only if
  the approved behavior was inadequately encoded.
- A fix depends on the corresponding review finding and remains capped at five
  minutes.
- Review agents never implement fixes. The main agent reruns focused validation
  after every fix.

## Concurrency And Integration

- Maximum concurrent test-writer agents: 2. T1 and T2 may run concurrently
  because their owned files do not overlap.
- Maximum concurrent developer agents: 1. D1, D2, and D3 are dependency-ordered
  and touch release surfaces whose final names and commands must agree.
- Maximum concurrent code-review agents: 2. R1 and R2 may run concurrently once
  their dependencies are complete because their review surfaces do not overlap.
- Maximum concurrent finding-fix developers: 2 only when ownership is proven
  non-overlapping; otherwise serialize.
- Shared integration points owned by the main agent:
  - approved spec and plan import;
  - `.gitignore` worktree exclusion;
  - package command/workflow/README naming consistency;
  - full-worktree test, lint, build, pack, workflow, and diff validation;
  - review-finding routing and regression assessment;
  - final staging, branch creation, commit, push, and status reconciliation.

## Main-Agent QA And Validation

The main agent owns final QA and does not delegate it.

### Repository validation

1. Inspect the complete worktree diff and classify every modified, added,
   deleted, renamed, and untracked path.
2. Run `npm test` using the repository script.
3. Run `npm run lint`. If the known unchanged CRLF errors in
   `src/@types/homebridge-lib.d.ts` remain, record their exact baseline and prove
   no new lint failures were introduced; do not widen scope silently.
4. Run `npm run build`.
5. Run `npm run prepublishOnly`, applying the same baseline distinction if lint
   remains blocked.
6. Run the release tests for accepted and rejected tags, secret scoping,
   subprocess safety, tarball inspection, failures, and cleanup through
   `npm test` rather than a raw TypeScript invocation.
7. Run a secret-free local package inspection with
   `npm pack --dry-run --json` and verify the allowlisted runtime/schema files
   are present and source, tests, specs, plans, workflows, agent artifacts,
   local state, and secrets are absent.
8. Validate `.github/workflows/publish.yml` syntax with an already available
   local validator if one exists. Do not download new tooling solely for this
   check. Always run the deterministic workflow contract tests.
9. Confirm `.github/workflows/build.yml` is unchanged unless a documented,
   approved necessity arose.
10. Run `git diff --check`.

### Read-only external preflight

1. Verify `https://forgejo.alexlab.nl/api/v1/version` succeeds with standard TLS
   verification and without `-k` or another bypass after the operator updates
   the certificate chain.
2. Verify the `public` organization remains visible as public.
3. Do not request, reveal, or validate a real token in logs.
4. Do not push a release tag or run `npm publish` against the live registry.

### Security and regression QA

- Confirm no tracked `.npmrc`, credential, local runtime state, tarball, build
  output, or machine-specific configuration was added.
- Confirm tag and environment input cannot reach a shell interpreter.
- Confirm the token is removed from every validation child environment and is
  available only for the publish request.
- Confirm branch and pull-request events cannot enter the publish workflow.
- Confirm the release job never runs `npm audit fix` and does not depend on
  mutated dependency state from the existing build matrix.
- Confirm no plugin runtime, Homebridge schema behavior, or existing test
  behavior changed.
- Confirm package contents include the compiled entrypoint and required
  `config.schema.json` while excluding approved non-package material.
- Confirm duplicate versions fail without deletion, overwrite, or tag mutation.

## Review And Finding Resolution

- Run R1 and R2 after their development dependencies complete.
- The main agent must inspect every finding against the approved spec and plan.
- Route each actionable in-scope finding to a new clean-context developer fix
  unit with a narrow ownership boundary.
- Rerun focused validation after each fix, then rerun the complete QA set.
- Record non-actionable observations separately from resolved defects.
- Stop for spec or plan amendment if a finding requires broader credentials,
  another tag/version policy, package scoping, insecure TLS, live publishing,
  or scope outside the approved artifacts.

## Documentation Acceptance

- README instructions must match the actual script name, environment variables,
  registry URL, package name, tag format, GitHub secret, and workflow behavior.
- The configuration section must distinguish Forgejo account/token setup,
  GitHub repository secret setup, tag trust policy, runner connectivity, and
  nginx full-chain TLS correction.
- Documentation must state that public visibility follows the public Forgejo
  owner and that writing still requires authorization.
- Documentation must state that no insecure TLS bypass is supported.
- Documentation must state that implementation does not publish a package and
  remains DRAFT until the operator validates the first real tag round trip.

## Delivery, Commit, And Push

- After development reaches DRAFT delivery or repository-side Definition of
  Done, create `feature/forgejo-npm-tag-publishing` from the detached task
  worktree without rebasing or changing the approved base.
- Reconcile the complete final worktree before staging. Classify every modified,
  added, deleted, renamed, and untracked path and preserve unrelated user work.
- Stage every accepted in-scope path, including `.gitignore`, the approved spec
  and plan, tests, release script, package metadata, workflow, and README.
- Inspect `git diff --cached --name-status`, the complete staged diff, and
  `git diff --cached --check` before committing.
- Expected commit message while live publishing remains unvalidated:
  `feature: DRAFT add Forgejo npm tag publishing`.
- Commit the complete accepted staged set and push
  `feature/forgejo-npm-tag-publishing` to `origin` with upstream tracking.
- Do not create or push a release tag and do not publish a package as part of
  implementation delivery.
- After the commit, inspect both task-worktree and invoking-checkout status.
  Confirm no accepted in-scope change remains uncommitted, unstaged, untracked,
  or omitted. Identify and preserve all unrelated changes.
- Verify the local delivery branch is not ahead of its configured upstream.
- Do not amend, rebase, force-push, merge, or delete the worktree or branch as
  part of delivery.

## Completion Classification

- Repository-side delivery is DRAFT even if all deterministic tests, review,
  QA, documentation, commit, and push steps succeed, because the approved spec
  requires an operator-owned real tag-triggered publication and clean install
  for operational acceptance.
- If the certificate chain still fails standard verification, report that
  external blocker separately and retain DRAFT.
- Final delivery is possible only after the operator confirms a valid release
  tag built, published, verified, and installed successfully through the live
  GitHub Actions and Forgejo path.

## Completion Report Requirements

The implementation completion report must state:

- summary of the approved release behavior delivered;
- every review and QA issue found and how it was resolved;
- exact validation passed, failed, blocked, or not run;
- certificate-chain preflight result;
- confirmation that no live tag or package publish was performed;
- remaining operational first-publish and installation acceptance;
- documentation changes;
- all changed paths and unrelated preserved paths;
- commit hash, delivery branch, push/upstream status;
- DRAFT or final classification and why;
- skipped, blocked, incomplete, or unvalidated Definition of Done items;
- whether the applicable Definition of Done was fully satisfied;
- final main-agent acceptance result.
