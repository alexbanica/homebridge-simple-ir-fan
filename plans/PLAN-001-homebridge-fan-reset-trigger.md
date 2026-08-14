# PLAN-001 - Homebridge Fan Reset And Rotation Triggers

Status: Approved
Date: 2026-08-10
Updated: 2026-08-14

## Approved Spec

- `specs/SPEC-001-homebridge-fan-reset-trigger.md`
- Status verified as `Approved` after the reset-style rotation iteration.

## Objective

Preserve the delivered optional per-fan Reset Switch and add an independently
configured momentary Rotation Toggle Switch to the same fan accessory. Replace
stateful SwingMode and `startRotation`/`stopRotation` configuration with one
strict `endpoints.rotate` action, validate the complete final behavior, and
commit and push every accepted in-scope change.

## Implementation Context Boundary

- Implementation starts only in a fresh session, after context is cleared, or
  after explicit same-context confirmation for that invocation.
- Load only applicable instructions, the approved spec and plan, branch and
  worktree state, files listed here, and minimal local edit patterns.
- Do not perform product, architecture, scope, or plan research during
  implementation.
- Treat current Device Integration API OpenAPI and controller behavior as
  read-only contract input for bodyless `POST /api/v1/fan/rotate` and exact
  `202` success.
- Do not edit `/home/alexbanica/workspace/device-integration-api`.
- Preserve the currently delivered reset behavior. A material contract mismatch
  or missing/ambiguous behavior requires an approved artifact amendment.

## Branch And Worktree Policy

- Delivery branch: `feature/homebridge-fan-reset-trigger`.
- Expected base state: existing commit `e70cf86`, with `origin/latest` remaining
  an ancestor and the branch tracking
  `origin/feature/homebridge-fan-reset-trigger`.
- Implementation remains in the invoking checkout; no linked worktree is used.
- Reuse the existing delivery branch and verify it before edits. Do not create a
  replacement branch, amend the pushed reset commit, rebase, or force-push.
- At implementation start, fetch `origin`, verify ancestry and upstream state,
  and classify every worktree change. The approved spec and proposed/approved
  plan edits are expected in-scope changes.
- Stop if branch identity, ancestry, upstream state, or unexplained worktree
  changes conflict with this plan.
- Subagents must not create or switch branches, commit, push, or revert unrelated
  edits. They are not alone in the checkout and must preserve other units' work.

## Final Intended Architecture And Affected Files

### Approved artifacts

- `specs/SPEC-001-homebridge-fan-reset-trigger.md`: approved final reset and
  rotation behavior.
- `plans/PLAN-001-homebridge-fan-reset-trigger.md`: approved execution contract.

### Per-fan configuration contract

- Add `src/dtos/FanRotationEndpointInterface.ts` with only `uri` and literal
  `method: 'POST'`.
- Update `src/dtos/FanEndpoints.ts` to remove `startRotation` and
  `stopRotation`, retain `reset`, and add optional
  `rotate?: FanRotationEndpointInterface`.
- Update `config.schema.json` and the package-embedded schema in `package.json`
  identically:
  - remove `startRotation` and `stopRotation`;
  - add optional strict `rotate` with an absolute HTTP(S) URI whose exact path is
    `/api/v1/fan/rotate`;
  - reject query, fragment, credentials, malformed port, extra fields, and any
    method other than `POST`;
  - preserve reset and all unrelated schema behavior.
- Update `config.example.json` to replace the two legacy rotation descriptors
  with one `rotate` descriptor.

### Rotation application and HTTP infrastructure

- Add `src/fan/services/FanRotationGatewayInterface.ts` with one
  `rotate(): Promise<void>` operation.
- Add `src/fan/services/FanRotationServiceInterface.ts` with the same inward
  application operation.
- Add `src/fan/services/FanRotationService.ts` to coalesce one in-flight rotation
  request per configured fan and clear it after success or failure.
- Add `src/fan/infrastructures/DeviceIntegrationApiFanRotationGateway.ts`:
  - accept the configured full rotation URI;
  - validate HTTP(S), exact `/api/v1/fan/rotate`, no query, fragment, or
    credentials;
  - send a bodyless unauthenticated `POST`;
  - use injected/default fetch and configured timeout;
  - treat only `202` as success;
  - perform no retry and emit secret-safe contained errors;
  - depend only on the inward rotation gateway contract.
- Keep existing reset gateway and service contracts behaviorally unchanged.
  Small type-only reuse is permitted only if it cannot alter reset behavior or
  blur action-specific errors.

### Homebridge adapter and lifecycle

- Update `src/platformAccessory.ts`:
  - preserve Fanv2 Active and RotationSpeed handlers;
  - remove SwingMode get/set binding and the old `FanService.toggleRotate()`
    flow;
  - remove a superseded SwingMode characteristic where the Homebridge API
    supports characteristic reconciliation and never bind it again;
  - compose the optional rotation gateway/service from `device.endpoints.rotate`
    using `device.timeoutMs ?? 5000`;
  - add one stable-subtype `fan-rotation-toggle` Switch named for the configured
    fan on the existing accessory;
  - reconcile the cached Rotation Toggle Switch when config is added, removed,
    or invalid without affecting Fanv2 or Reset;
  - keep the Switch OFF while idle, ON while pending, and OFF after every
    outcome;
  - make OFF a no-op, coalesce concurrent same-fan rotation writes, keep reset
    and rotation independent, and allow later retries;
  - log one concise result per shared action without endpoint secrets;
  - map failures to `SERVICE_COMMUNICATION_FAILURE` and contain all async errors;
  - make no `isRotating` or final physical-state claim.
- Update `src/services/FanService.ts` to remove the superseded
  `toggleRotate()` method while preserving refresh, power, speed, and status
  behavior. Retain `isRotating` response ingestion only if still needed by an
  existing non-SwingMode contract; otherwise remove only dead rotation-specific
  state access proven unused by tests and TypeScript.
- `src/platform.ts` is expected unchanged. It must continue registering only
  configured fan UUIDs and no separate action accessories.
- `src/index.ts` and `src/settings.ts` remain unchanged.

### Deterministic tests

- Add `test/deviceIntegrationApiFanRotationGateway.test.ts` for URI validation,
  exact HTTP contract, timeout, no retry, only-202 success, and secret-safe
  errors.
- Add `test/fanRotationService.test.ts` for idle activation, identical in-flight
  promise reuse, later activation, failure sharing, and recovery.
- Update `test/platformAccessory.test.ts` for optional same-accessory Rotation
  Toggle composition, stable subtype, cached add/remove, pending/OFF states,
  same-fan coalescing, cross-fan and reset independence, timeout, logging, HAP
  failures, retry, no final-state claim, and unchanged Fanv2/reset behavior.
- Update `test/platform.test.ts` only for lifecycle assertions proving no
  separate rotation accessory, stable fan UUIDs, and cached Rotation Toggle
  reconciliation through the platform path.
- Update `test/configSchema.test.ts` for schema parity, strict `rotate`, removal
  of `startRotation`/`stopRotation`, and example agreement.
- Keep existing reset tests passing without weakening their assertions.

### Documentation

- Update `README.md` with exact `endpoints.rotate` placement, request contract,
  momentary behavior, failure behavior, state limitation, and migration from
  `startRotation`/`stopRotation` and SwingMode.
- Keep reset migration and behavior documentation accurate.
- Do not update `AGENTS.md` unless an approved architecture boundary becomes
  factually stale.

## Test Strategy

- Test-first applies to the rotation gateway, application coalescing, accessory
  behavior, lifecycle reconciliation, and configuration migration.
- Use the existing Node test runner and TypeScript harness; add no dependency or
  test framework.
- Each test unit records an intentional failing state before dependent
  production work begins.
- Tests use fakes, injected fetch, or loopback HTTP only and never contact a live
  API, Homebridge, Home, or HomeKit runtime.
- Preserve existing reset assertions and fan regression tests.

## Dependency-Aware Work Graph

Maximum planned concurrency: three test-writers, two developers, and three code
reviewers. Every assignment is limited to five minutes of active work. The main
agent serializes integration of shared files.

### T1 - Rotation gateway and application tests

- Type: test-first.
- Agent: one clean-context `test-writer`.
- Owned files: new `test/deviceIntegrationApiFanRotationGateway.test.ts` and
  `test/fanRotationService.test.ts`.
- Dependencies: approved spec and plan.
- Acceptance: intentional red tests cover strict URI/method/body/status,
  timeout/no retry, secret safety, per-service coalescing, settlement clearing,
  shared failure, and recovery.
- Validation: focused TypeScript compile and focused Node tests; record red
  evidence.

### T2 - Rotation accessory and lifecycle tests

- Type: test-first.
- Agent: one clean-context `test-writer`.
- Owned files: `test/platformAccessory.test.ts` and `test/platform.test.ts`.
- Dependencies: approved spec and plan.
- Acceptance: intentional red tests cover optional same-accessory Switch,
  stable subtype, no separate accessory, cached add/remove, SwingMode removal,
  pending/OFF transitions, same-fan coalescing, different-fan/reset
  independence, failures, retry, timeout, logging, HAP mapping, UUID stability,
  and preserved Fanv2/reset behavior.
- Validation: focused compile/tests; record red evidence.

### T3 - Rotation configuration contract tests

- Type: test-first.
- Agent: one clean-context `test-writer`.
- Owned file: `test/configSchema.test.ts`.
- Dependencies: approved spec and plan.
- Acceptance: intentional red tests prove strict optional `rotate` parity in
  both schemas, removal of legacy rotation fields, preservation of reset, and
  example/schema agreement.
- Validation: focused compile/test; record red evidence.

### D1 - Rotation gateway and application implementation

- Type: development.
- Agent: one clean-context `developer`.
- Owned files: new `src/fan/infrastructures/DeviceIntegrationApiFanRotationGateway.ts`,
  `src/fan/services/FanRotationGatewayInterface.ts`,
  `src/fan/services/FanRotationServiceInterface.ts`, and
  `src/fan/services/FanRotationService.ts`.
- Dependencies: T1 complete.
- Acceptance: T1 passes and the implementation satisfies exact action contract,
  coalescing, recovery, containment, and onion dependency direction.
- Validation: focused T1, changed-file lint, build, and diff check.

### D2 - Rotation accessory and lifecycle integration

- Type: development.
- Agent: one clean-context `developer`.
- Owned files: `src/platformAccessory.ts` and `src/services/FanService.ts`.
- Dependencies: T2 and D1 complete.
- Acceptance: T2 passes; Rotation Toggle is optional, momentary,
  stable-subtype, same-accessory, reconciled, failure-contained, independent of
  Reset, and free of active SwingMode behavior while Fanv2/reset regressions
  remain passing.
- Validation: focused T2, existing reset tests, changed-file lint, build, and
  diff check.

### D3 - Rotation configuration migration

- Type: development.
- Agent: one clean-context `developer`.
- Owned files: new `src/dtos/FanRotationEndpointInterface.ts`,
  `src/dtos/FanEndpoints.ts`, `config.schema.json`, `package.json`, and
  `config.example.json`.
- Dependencies: T3 complete.
- Acceptance: T3 passes; DTOs, both schemas, and example expose one strict
  optional rotate descriptor, reject legacy fields, and preserve reset and all
  unrelated package/config behavior.
- Validation: focused T3, JSON parsing, build, applicable changed-file lint, and
  diff check.

### D4 - Documentation

- Type: documentation; test-first is not applicable because this unit documents
  tested final behavior.
- Agent: one clean-context `developer`.
- Owned file: `README.md`.
- Dependencies: D2 and D3 complete.
- Acceptance: configuration, migration, request contract, momentary semantics,
  limitations, failures, and validation instructions agree with final code and
  both schemas; reset documentation remains accurate.
- Validation: compare examples against schemas and run diff check.

### R1 - Rotation gateway and application review

- Type: independent review; no edits.
- Agent: one clean-context `code-reviewer`.
- Scope: T1/D1 and retained reset action contracts.
- Dependencies: D1 complete.
- Acceptance: findings cover URI/path/method/body/status, timeout, no retry,
  secrets, coalescing, recovery, dependency direction, test strength, and
  spec/plan fit.

### R2 - Accessory and lifecycle review

- Type: independent review; no edits.
- Agent: one clean-context `code-reviewer`.
- Scope: T2/D2 and resulting adapter/lifecycle diff.
- Dependencies: D2 complete.
- Acceptance: findings cover same-accessory identity, stable subtype, cache
  reconciliation, SwingMode removal, HAP states/errors, reset independence,
  fan regressions, async containment, tests, and artifact fit.

### R3 - Configuration and documentation review

- Type: independent review; no edits.
- Agent: one clean-context `code-reviewer`.
- Scope: T3/D3/D4, schemas, DTOs, example, package metadata, and README.
- Dependencies: D3 and D4 complete.
- Acceptance: findings cover parity, strictness, migration accuracy, reset
  preservation, package integrity, documentation, and artifact fit.

### F - Review and QA fixes

- Type: conditional development.
- Agent: one new clean-context `developer` per non-overlapping finding.
- Ownership: smallest approved files needed for the specific finding.
- Dependencies: corresponding review or main-agent QA finding.
- Acceptance: finding is resolved within approved scope and affected checks
  pass; material fixes receive an independent reviewer recheck.

## Shared-File And Integration Rules

- T1, T2, and T3 may run concurrently because ownership does not overlap.
- D1 and D3 may run concurrently after their respective tests complete.
- D2 waits for D1 because it composes the new rotation service.
- D4 waits for D2 and D3 so names and behavior are final.
- Production developers do not rewrite tests to fit implementation.
- Schema/package/config files are owned only by D3; accessory/service files are
  owned only by D2.
- At five minutes, the main agent stops an active subagent, records completed and
  partial work, changed files, validation, blockers, and remainder, preserves
  usable edits, and splits the remainder before assigning a new clean-context
  agent.
- Any behavior outside approved artifacts requires amendment rather than an
  integration workaround.

## Main-Agent QA

The main agent must:

1. Map every acceptance criterion to code, tests, docs, or an explicitly
   unavailable runtime check.
2. Inspect the complete diff for unintended reset changes, remaining
   `startRotation`/`stopRotation` or SwingMode bindings, separate action
   accessories, secrets, generated output, machine-specific config, and
   out-of-scope edits.
3. Confirm fan UUID remains `serialNumber:name` based.
4. Confirm optional Reset and Rotation Toggle services reconcile independently
   with distinct stable subtypes.
5. Confirm invalid rotation configuration preserves Fanv2 and Reset and logs no
   raw endpoint.
6. Confirm rotation success makes no final physical or `isRotating` state claim.
7. Run `npm test`.
8. Run `npm run lint`; if unchanged CRLF baseline errors remain, record exact
   paths and separately run changed-file lint.
9. Run `npm run build`.
10. Run `npm run prepublishOnly` and distinguish any unchanged baseline blocker.
11. Run `git diff --check`, then after staging `git diff --cached --check`.
12. Confirm tests use only deterministic local fakes/injected fetch/loopback.
13. Confirm DTOs, both schemas, example, runtime behavior, and README agree.

Starting Homebridge, using Home/HomeKit, or calling a live API is operational
validation and requires explicit user authorization and target confirmation. If
unavailable, list it as not run and keep delivery DRAFT.

## Documentation And Contract Policy

- Update only repository artifacts listed in this plan.
- Do not edit the Device Integration API repository, OpenAPI, specs, source, or
  tests.
- Document that reset affects API application state only and rotation is a
  momentary accepted action with no final-state guarantee.
- Do not modify public plugin identifiers.

## Commit, Push, And Completion

- Before staging, reconcile every modified, added, deleted, renamed, and
  untracked path. Preserve and identify unrelated user changes.
- Stage every accepted in-scope path, including approved artifacts, production
  code, tests, schemas, example config, and documentation.
- Inspect `git diff --cached --name-status`, the complete staged diff, and
  `git diff --cached --check` before committing.
- Use one follow-up commit:
  - final only if all required validation including authorized runtime/Home
    validation passes: `feature: Add per-fan rotation toggle action`;
  - otherwise: `feature: DRAFT add per-fan rotation toggle action`.
- Push `feature/homebridge-fan-reset-trigger` to `origin` without force and
  verify it is no longer ahead of its upstream.
- Inspect final status and do not report completion while any accepted in-scope
  change is uncommitted, unpushed, hidden, or omitted.
- Completion reporting must cover summary, review/QA findings and resolutions,
  validation run/not run, risks, documentation, commit/push state, final or
  DRAFT status, skipped/blocked requirements, Definition of Done, and final
  main-agent acceptance.
