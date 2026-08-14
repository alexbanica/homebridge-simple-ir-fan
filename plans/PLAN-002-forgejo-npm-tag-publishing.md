# PLAN-002 - Forgejo npm Tag Publishing

Status: Approved
Date: 2026-08-14

## Approved Spec

- `specs/SPEC-002-forgejo-npm-tag-publishing.md`
- Status verified as `Approved` on 2026-08-14.

## Objective

Update the already delivered Forgejo npm release workflow to use GitHub's
single-CPU `ubuntu-slim` runner while preserving every other approved release,
security, packaging, documentation, and DRAFT-acceptance behavior.

The implementation must update and push the existing delivery branch. It must
not create a release tag or publish a package.

## Final Intended State

- `.github/workflows/publish.yml` uses exactly `runs-on: ubuntu-slim`.
- The release job still checks out the exact pushed tag, uses Node 24, runs
  `npm ci`, and exposes `FORGEJO_PACKAGE_TOKEN` only to
  `npm run publish:forgejo`.
- No Docker, privileged operation, kernel feature, persistent runner
  customization, additional package manager, or new dependency is introduced.
- The job remains constrained by `ubuntu-slim`'s minimal tool set and
  15-minute timeout.
- `test/publishWorkflow.test.ts` deterministically requires `ubuntu-slim` and
  rejects `ubuntu-latest` or another runner label.
- `README.md` identifies `ubuntu-slim` as the release runner and records its
  lightweight/minimal-image and 15-minute constraints.
- The updated approved spec and plan are included in the delivery commit.
- All other files and behavior from commit `27b8683` remain unchanged.

## Preserved Constraints

- Stable tags remain exact `vMAJOR.MINOR.PATCH` values.
- The package remains unscoped and publishes only to the approved public
  Forgejo registry with npm dist-tag `latest`.
- TLS verification may not be bypassed.
- The Forgejo token remains scoped to the publish operation.
- Normal branch and pull-request workflows never publish.
- Duplicate versions fail without deletion or overwrite.
- The first live tag, publish, registry verification, and clean install remain
  operator-owned; delivery remains DRAFT until they succeed.

## Implementation Context Boundary

- Start only in a fresh session, after context clear, or after explicit
  same-context confirmation.
- Load applicable instructions, the approved SPEC-002 and PLAN-002, current
  branch/worktree state, and only the files named by this plan.
- Do not repeat registry, authentication, package, or release architecture
  research.
- Stop for an artifact amendment if `ubuntu-slim` proves unavailable, lacks a
  required standard Node/npm capability, or requires a broader workflow change.
- No architecture agent is planned because the delta is isolated workflow
  configuration, deterministic contract coverage, and matching documentation.

## Branch And Worktree Policy

- Delivery branch: `feature/forgejo-npm-tag-publishing`.
- Expected base and existing branch tip:
  `27b8683e9dc5d64b580004f194adce49f861041d`.
- Existing implementation worktree:
  `.worktrees/forgejo-npm-tag-publishing`.
- Reuse that exact worktree and its existing delivery branch; do not create a
  second worktree or branch.
- Before edits, fetch `origin` and verify the local branch, its upstream, and
  `origin/feature/forgejo-npm-tag-publishing` all resolve to the expected base.
- Require the implementation worktree to be clean before importing the newly
  approved spec and plan from the invoking checkout.
- Preserve the invoking checkout's planning artifacts and `.gitignore` change.
- Do not rebase, merge, amend, force-push, change the base, or delete the
  worktree or branch.
- Workers must not manage branches/worktrees, stage, commit, push, reset, or
  revert another unit's work.

## Dependency-Aware Execution Graph

Every subagent assignment is capped at five minutes of active work. The main
agent supervises elapsed time and applies the approved timeout/resplitting
rules from the repository instructions.

### T1 - Runner contract test

- Type: test-first workflow-contract unit.
- Agent: clean-context `test-writer`.
- Ownership: `test/publishWorkflow.test.ts` only.
- Dependencies: none.
- Assignment: replace the `ubuntu-latest` expectation with an exact
  `ubuntu-slim` requirement and reject alternative runner labels while
  preserving all existing workflow security assertions.
- Acceptance: the focused workflow test fails only because the workflow still
  uses `ubuntu-latest`.
- Validation: `npm test` through the repository script.
- Maximum active time: five minutes.

### D1 - Slim release runner

- Type: workflow configuration.
- Agent: clean-context `developer`.
- Ownership: `.github/workflows/publish.yml` only.
- Dependencies: T1 complete.
- Assignment: change only the release job runner label to `ubuntu-slim`.
- Acceptance: T1 passes; exact tag checkout, Node 24, clean install,
  permissions, concurrency, registry, and secret scoping remain unchanged.
- Validation: `npm test`, available local YAML syntax validation, and
  `git diff --check`.
- Maximum active time: five minutes.

### D2 - Runner documentation

- Type: documentation-only; separate test-first work is not applicable.
- Agent: clean-context `developer`.
- Ownership: `README.md` only.
- Dependencies: D1 complete.
- Assignment: document the selected `ubuntu-slim` runner, its minimal tool set,
  lack of Docker/privileged requirements, and 15-minute job limit.
- Acceptance: documentation matches the final workflow without changing the
  existing operator-owned DRAFT boundary.
- Validation: targeted text review and `git diff --check`.
- Maximum active time: five minutes.

### R1 - Runner iteration review

- Type: independent code review.
- Agent: clean-context `code-reviewer`.
- Ownership: read-only review of T1, D1, and D2 diffs.
- Dependencies: D2 complete.
- Assignment: review exact runner selection, regression-test strength,
  preserved workflow security, minimal-image compatibility claims, and README
  accuracy against the approved artifacts.
- Acceptance: findings include severity and exact file/line evidence; the
  reviewer does not implement fixes.
- Maximum active time: five minutes.

### Finding-fix units

- Route each actionable review or QA finding to a new clean-context
  `developer` with ownership limited to the affected file.
- Tests may change only when the approved contract was inadequately encoded.
- Each fix is capped at five minutes and followed by focused and full QA.

## Concurrency And Integration

- Maximum concurrent test-writer agents: 1.
- Maximum concurrent developer agents: 1 because D1 and D2 are ordered.
- Maximum concurrent code-review agents: 1.
- The main agent owns approved-artifact import, full-diff reconciliation, QA,
  staging, commit, push, and final acceptance.
- All agents share the repository and must preserve one another's changes.

## Main-Agent QA And Validation

1. Inspect and classify every modified, added, deleted, renamed, and untracked
   path in both the implementation worktree and invoking checkout.
2. Confirm only the approved spec, plan, workflow, workflow test, README, and
   any strictly necessary deterministic test-runner metadata changed from
   commit `27b8683`.
3. Run `npm test` and confirm all existing release and plugin tests pass.
4. Run `npm run lint`.
5. Run `npm run build`.
6. Run `npm run prepublishOnly`.
7. Validate `.github/workflows/publish.yml` syntax using already available
   local tooling; do not download a validator solely for this change.
8. Confirm the workflow uses exactly `ubuntu-slim` and contains no Docker,
   privileged, insecure TLS, audit-fix, tag mutation, deletion, overwrite, or
   additional secret exposure behavior.
9. Confirm `.github/workflows/build.yml`, release tooling, package metadata,
   package lock, plugin runtime, and Homebridge schema are unchanged.
10. Run `git diff --check`.

No live workflow run, release tag, package publish, or clean registry install is
authorized by this iteration.

## Documentation Acceptance

- README wording must match the actual `ubuntu-slim` workflow label.
- It must state that the lightweight runner provides a minimal environment and
  has a 15-minute job limit.
- It must not claim the live release path has been validated.
- Existing token, TLS, registry, tag-policy, and DRAFT guidance must remain
  intact.

## Delivery, Commit, And Push

- Import the updated approved spec and plan into the existing implementation
  worktree verbatim.
- Reconcile the complete worktree and stage every accepted in-scope path.
- Inspect `git diff --cached --name-status`, the complete staged diff, and
  `git diff --cached --check` before committing.
- Expected commit message:
  `chore: DRAFT use slim runner for Forgejo publishing`.
- Commit on `feature/forgejo-npm-tag-publishing` and push to its existing
  `origin/feature/forgejo-npm-tag-publishing` upstream.
- Verify the local branch is not ahead of or behind its upstream after push.
- Do not amend the previous commit, force-push, create a release tag, or publish
  a package.

## Completion Classification

- Repository-side runner iteration is complete when review, deterministic QA,
  documentation, commit, and push succeed.
- Overall Forgejo publishing delivery remains DRAFT until the operator-owned
  live tag/publish/verification/install round trip succeeds.
- A real `ubuntu-slim` run exceeding 15 minutes or lacking required tooling is
  an operational finding requiring a new approved iteration; no implicit
  fallback to a larger runner is allowed.

## Completion Report Requirements

Report the runner change, review and QA findings, validation performed and not
performed, documentation updates, changed and preserved paths, commit hash,
branch/upstream status, absence of live tag/publish activity, DRAFT reason,
Definition of Done gaps, and final main-agent acceptance.
