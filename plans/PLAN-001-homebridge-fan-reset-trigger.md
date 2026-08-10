# PLAN-001 - Homebridge Fan Reset Trigger

Status: Approved
Date: 2026-08-10

## Approved Spec

- `specs/SPEC-001-homebridge-fan-reset-trigger.md`
- Updated spec status verified as `Approved` before this plan revision.

## Objective

Move reset from the superseded platform-level accessory into an optional
per-configured-fan endpoint and momentary Switch service on that fan's existing
HomeKit accessory. Preserve all current Fanv2 behavior, reconcile cached reset
services and the old global reset accessory, validate deterministically, and
deliver every accepted in-scope artifact in a pushed follow-up commit.

## Implementation Context Boundary

- Implementation must begin in a fresh session, after context is cleared, or
  after the user explicitly confirms same-context implementation.
- Load only applicable instructions, this approved spec and approved plan,
  current branch/worktree state, files listed in this plan, and minimal local
  edit patterns.
- Product research, architecture research, broad scope discovery, plan
  discovery, and changes to the Device Integration API are prohibited during
  implementation.
- The OpenAPI reset operation and approved API `SPEC-007` remain read-only
  contract inputs. Stop for an artifact amendment if method, path, body,
  authentication, or response behavior differs.
- Existing Fanv2 power, speed, oscillation, status, authentication, device UUID,
  and cache behavior on `origin/latest` are the regression baseline.
- Missing, ambiguous, incorrect, or materially different behavior discovered
  during implementation requires an approved spec or plan amendment.

## Branch And Worktree Policy

- Continue on existing branch `feature/homebridge-fan-reset-trigger`, currently
  rebased onto `origin/latest` and tracking
  `origin/feature/homebridge-fan-reset-trigger`.
- At implementation start, fetch `origin`; verify `origin/latest` remains an
  ancestor of the feature branch and classify every worktree change.
- The approved spec and proposed/approved plan edits are expected in-scope
  worktree changes and must be preserved for the implementation commit.
- Do not create a replacement branch, amend the previously pushed reset commit,
  rebase again, or force-push unless the user explicitly requests it.
- If the branch has diverged or contains unexplained changes beyond the approved
  artifacts, stop before changing branch state.
- Subagents must not create or switch branches, commit, push, or revert unrelated
  edits. They are not alone in the worktree and must accommodate completed units.

## Final Intended Architecture And Affected Files

### Approved artifacts

- `specs/SPEC-001-homebridge-fan-reset-trigger.md`: approved final behavior.
- `plans/PLAN-001-homebridge-fan-reset-trigger.md`: approved final execution
  contract.

### Per-fan configuration contract

- `src/dtos/FanResetEndpointInterface.ts`: add the inward configuration shape
  for reset with `uri` and literal `method: 'POST'`; it accepts no headers,
  query, authentication, or body configuration.
- `src/dtos/FanEndpoints.ts`: add optional
  `reset?: FanResetEndpointInterface` without changing existing endpoint fields.
- `config.schema.json`: remove top-level `apiBaseUrl`; add optional per-device
  `endpoints.reset` with an absolute HTTP(S) URI, exact reset path, no
  query/fragment/credentials, `POST` const, and no extra fields.
- `package.json`: make the same change in the package-embedded Homebridge schema;
  preserve package identity, dependencies, and scripts.
- `config.example.json`: remove top-level `apiBaseUrl` and show an optional reset
  descriptor inside the configured fan's `endpoints`.

### Application and HTTP infrastructure

- `src/fan/services/FanResetGatewayInterface.ts`: expected unchanged.
- `src/fan/services/FanResetServiceInterface.ts`: expected unchanged.
- `src/fan/services/FanResetService.ts`: expected unchanged; retain per-instance
  one-in-flight coalescing and failure recovery.
- `src/fan/infrastructures/DeviceIntegrationApiFanResetGateway.ts`: accept the
  configured full reset URI rather than a global API origin; validate HTTP(S),
  exact `/api/v1/fan/reset` path, no query/fragment/credentials, and retain the
  bodyless POST, exact `202`, injected/per-fan timeout, no retry, and contained
  error behavior.

### Homebridge adapters and lifecycle

- `src/platformAccessory.ts`:
  - preserve `SimpleIrFanAccessory` and all Fanv2 handlers;
  - remove the standalone `FanResetPlatformAccessory` adapter;
  - when `device.endpoints.reset` is valid, compose a reset gateway/service for
    that fan using `device.timeoutMs ?? 5000`;
  - add one stable-subtype momentary Switch service to the same
    `PlatformAccessory` as Fanv2;
  - when reset is absent or invalid, remove any cached per-fan reset Switch while
    preserving Fanv2;
  - contain device-specific reset configuration and request failures, identify
    the fan in concise logs, and never log the raw endpoint or credentials;
  - keep reset writes independent of Fanv2 characteristic state.
- `src/platform.ts`:
  - remove top-level `apiBaseUrl`, global gateway/service composition, global
    reset discovery, and standalone reset registration;
  - discover only configured fan UUIDs so the superseded cached global reset
    accessory is unregistered by normal reconciliation;
  - preserve current configured-fan registration/restoration/removal behavior.
- `src/index.ts` and `src/settings.ts`: expected unchanged; public identifiers
  remain `homebridge-simple-ir-fan` and `SimpleIrFan`.

### Deterministic tests

- `test/deviceIntegrationApiFanResetGateway.test.ts`: replace global-base/default
  assumptions with full configured URI validation, exact path/body/method/status,
  timeout, no-retry, and secret-safe error tests.
- `test/fanResetService.test.ts`: retain current coalescing and recovery tests;
  add independent-service-instance coverage only if needed to prove per-fan
  isolation without coupling to Homebridge.
- `test/platformAccessory.test.ts`: test optional per-fan reset Switch creation
  on the same accessory, absence/removal, stable subtype, state transitions,
  same-fan coalescing, different-fan independence, timeout propagation, logging,
  HAP failure mapping, retry, and unchanged Fanv2 service presence.
- `test/platform.test.ts`: test no standalone reset registration, cleanup of the
  old global reset UUID, stable fan UUIDs, normal fan registration/restoration,
  and preservation of configured fan accessories.
- `test/configSchema.test.ts`: parse both schema locations and example config;
  prove top-level `apiBaseUrl` is absent and optional per-device reset schema is
  aligned, POST-only, and restrictive.
- `tsconfig.test.json`, `.gitignore`, `eslint.config.js`, and the `npm test`
  harness are expected unchanged.

### Documentation

- `README.md`: document optional per-fan reset configuration, same-accessory
  Switch semantics, migration from top-level `apiBaseUrl`, exact HTTP contract,
  timeout/no-retry/failure behavior, and the application-state-only limitation.
- `AGENTS.md`: expected unchanged; current architecture guidance remains valid.

## Test Strategy

- Test-first applies to configured-URI validation, per-fan service composition,
  HomeKit state/reconciliation, and schema migration.
- Use Node's built-in test runner and the existing TypeScript harness; add no
  dependencies or test framework.
- Each test unit must record an intentional failing state before its dependent
  production unit begins. Missing behavior or old global behavior is acceptable
  red evidence.
- Tests use fakes, injected fetch functions, or loopback HTTP only. They must not
  contact a live Device Integration API, fan endpoint, Homebridge instance, or
  HomeKit home.
- Preserve existing fan behavior tests and do not rewrite them merely to fit a
  regression.

## Dependency-Aware Work Graph

Maximum planned concurrency is three test-writers, two developers, and three
code reviewers. Every assignment is sized for no more than five minutes of
active work.

### T1 - Configured reset URI gateway tests

- Type: test-first.
- Agent: one clean-context `test-writer`.
- Owned file: `test/deviceIntegrationApiFanResetGateway.test.ts`.
- Boundary: full reset URI validation and HTTP contract only.
- Dependencies: approved spec and plan.
- Acceptance: intentional red tests cover valid configured URI, wrong path,
  non-HTTP(S), query, fragment, credentials, exact bodyless POST, only `202`,
  per-fan/default timeout, abort, no retry, and contained errors.
- Validation: focused TypeScript compile and focused Node test; record red result.

### T2 - Same-accessory reset service tests

- Type: test-first.
- Agent: one clean-context `test-writer`.
- Owned file: `test/platformAccessory.test.ts`.
- Boundary: configured fan accessory and reset Switch behavior.
- Dependencies: approved spec and plan.
- Acceptance: intentional red tests cover no reset option, valid reset on the
  same accessory, stable subtype, cached service removal, momentary states,
  OFF no-op, same-fan coalescing, per-fan isolation, failures, retry, logging,
  HAP mapping, timeout selection, and unchanged Fanv2 presence.
- Validation: focused compile/test; record red result.

### T3 - Platform lifecycle tests

- Type: test-first.
- Agent: one clean-context `test-writer`.
- Owned file: `test/platform.test.ts`.
- Boundary: configured fan UUIDs and global reset accessory removal.
- Dependencies: approved spec and plan.
- Acceptance: intentional red tests prove no separate reset registration, the
  superseded global reset UUID is removed, fan UUIDs remain stable, and fan
  registration/restoration/removal behavior is preserved.
- Validation: focused compile/test; record red result.

### T4 - Configuration contract tests

- Type: test-first.
- Agent: one clean-context `test-writer` after one of T1-T3 frees a slot.
- Owned file: `test/configSchema.test.ts`.
- Boundary: both schemas and example configuration only.
- Dependencies: approved spec and plan.
- Acceptance: intentional red tests prove no top-level `apiBaseUrl`, optional
  per-device reset shape, POST const, strict reset properties, and example/schema
  agreement.
- Validation: focused compile/test; record red result.

### D1 - Configured URI gateway implementation

- Type: development.
- Agent: one clean-context `developer`.
- Owned file: `src/fan/infrastructures/DeviceIntegrationApiFanResetGateway.ts`.
- Dependencies: T1 complete.
- Acceptance: T1 passes; configured full URI validation and existing exact HTTP
  behavior match the spec; no Homebridge dependency is introduced.
- Validation: focused T1, changed-file lint, build, and `git diff --check`.

### D2 - Per-fan accessory reset integration

- Type: development.
- Agent: one clean-context `developer`.
- Owned file: `src/platformAccessory.ts`.
- Dependencies: T2 and D1 complete.
- Acceptance: T2 passes; reset is optional, exists only as a stable Switch
  service on the fan accessory, reconciles cached services, uses per-fan timeout,
  preserves Fanv2 behavior, and contains all reset failures.
- Validation: focused T2, existing fan tests, changed-file lint, build, and diff
  check.

### D3 - Platform global-accessory removal

- Type: development.
- Agent: one clean-context `developer`.
- Owned file: `src/platform.ts`.
- Dependencies: T3 complete.
- Acceptance: T3 passes; no global reset is composed or registered, the stale
  global UUID is removed, and configured fan lifecycle behavior is unchanged.
- Validation: focused T3, build, changed-file lint, and diff check.

### D4 - Per-fan configuration and schema migration

- Type: development.
- Agent: one clean-context `developer`.
- Owned files: `src/dtos/FanResetEndpointInterface.ts`,
  `src/dtos/FanEndpoints.ts`, `config.schema.json`, `package.json`, and
  `config.example.json`.
- Dependencies: T4 complete.
- Acceptance: T4 passes; TypeScript and both schemas express the same optional,
  strict, POST-only reset descriptor; top-level `apiBaseUrl` is absent; package
  identity, scripts, dependencies, and existing endpoint contracts are intact.
- Validation: focused T4, JSON parsing, build, changed-file lint where
  applicable, and diff check.

### D5 - Documentation

- Type: documentation; test-first not applicable because it documents tested
  final behavior.
- Agent: one clean-context `developer`.
- Owned file: `README.md`.
- Dependencies: D2, D3, and D4 complete.
- Acceptance: configuration, same-accessory presentation, migration, request
  contract, failures, limitation, and validation commands match final code and
  both schemas.
- Validation: compare examples to schemas and run diff check.

### R1 - Gateway and application review

- Type: independent review; no edits.
- Agent: one clean-context `code-reviewer`.
- Scope: D1, gateway/service contracts, T1, and retained service tests.
- Dependencies: D1 complete.
- Acceptance: findings cover exact configured URI, POST/body/status/timeout,
  secret safety, no retry, coalescing, onion direction, tests, and spec/plan fit.

### R2 - Homebridge accessory and lifecycle review

- Type: independent review; no edits.
- Agent: one clean-context `code-reviewer`.
- Scope: D2/D3 and T2/T3.
- Dependencies: D2 and D3 complete.
- Acceptance: findings cover same-accessory identity, stable service subtype,
  cached add/remove, no global accessory, HAP states/errors, fan regressions,
  async containment, tests, and artifact fit.

### R3 - Configuration and documentation review

- Type: independent review; no edits.
- Agent: one clean-context `code-reviewer`.
- Scope: D4/D5, T4, DTOs, both schemas, example config, and README.
- Dependencies: D4 and D5 complete.
- Acceptance: findings cover contract alignment, strictness, migration accuracy,
  public identifiers, documentation, and artifact fit.

### F - Review and QA fixes

- Type: conditional development.
- Agent: a new clean-context `developer` for each non-overlapping finding.
- Boundary: smallest files affected by one specific review or main-agent QA
  finding.
- Dependencies: corresponding review or QA finding.
- Acceptance: finding resolved within approved scope and affected checks pass;
  material fixes receive a clean-context reviewer recheck.

## Shared-File And Integration Rules

- T1/T2/T3 own separate tests and may run concurrently. T4 starts when a slot is
  free.
- D1 and D3 may run concurrently because their files do not overlap. D2 waits
  for D1 because it composes the revised gateway.
- D4 owns every configuration-contract file and is serialized against package or
  schema edits by all other units.
- D5 starts only after runtime/config names and shapes are final.
- Test files are not rewritten by production developers to fit implementation.
- The main agent supervises dependencies, ownership, handoffs, integration, and
  five-minute limits. A timed-out unit is stopped, inspected, preserved, and
  split into smaller non-overlapping work before reassignment.
- Behavior or execution changes outside the approved artifacts require an
  amendment, not an integration workaround.

## Main-Agent QA

The main agent must:

1. Map every approved acceptance criterion to code, tests, documentation, or an
   explicitly unavailable runtime check.
2. Inspect the complete diff for the global reset UUID/accessory, top-level
   `apiBaseUrl`, stale standalone adapter code, accidental fan-control changes,
   generated files, secrets, machine-specific config, and out-of-scope edits.
3. Confirm each fan UUID remains `serialNumber:name` based and reset service
   changes do not register accessories.
4. Confirm fans without reset have no Switch and restored fans remove stale
   reset services when configuration is removed.
5. Confirm invalid reset configuration preserves Fanv2 functionality and never
   logs raw endpoint data.
6. Run `npm test`.
7. Run `npm run lint` and, if an unchanged baseline blocks it, record the exact
   baseline paths while separately proving changed-file lint passes.
8. Run `npm run build`.
9. Run `npm run prepublishOnly`.
10. Run `git diff --check` and, after staging, `git diff --cached --check`.
11. Confirm tests use only fakes, injected fetch, or loopback traffic.
12. Confirm schemas, TypeScript DTOs, example config, runtime behavior, and
    README agree.

Starting Homebridge, interacting with Home/HomeKit, or calling a live API is
operational validation and must not occur without explicit user authorization
and target confirmation. If unavailable, list it as not run and keep delivery
DRAFT because same-accessory Home presentation is unverified.

## Documentation And Contract Policy

- Update only repository documentation and configuration artifacts listed here.
- Do not edit the Device Integration API OpenAPI document, source, specs, or
  tests.
- Document that reset changes API application state only and does not prove
  physical fan state.
- Do not modify `AGENTS.md` unless an approved file boundary becomes factually
  stale.

## Commit, Push, And Completion

- Before staging, reconcile every modified, added, deleted, renamed, and
  untracked path; preserve and identify unrelated user changes.
- Stage every accepted in-scope path, including approved spec/plan updates,
  production code, tests, schemas, example config, and documentation.
- Inspect `git diff --cached --name-status`, the complete staged diff, and
  `git diff --cached --check` before committing.
- Use one follow-up project-convention commit:
  `feature: Move fan reset control onto configured fans` only if all required
  validation including authorized runtime/Home validation passes; otherwise use
  `feature: DRAFT move fan reset control onto configured fans`.
- Push the existing feature branch to `origin` without force and verify it is no
  longer ahead of its upstream.
- After push, inspect final status and do not report completion while any
  accepted in-scope path is uncommitted, unpushed, hidden, or omitted.
- Completion reporting must include summary, review/QA findings and resolutions,
  validation run/not run, risks, documentation, commit/push status, final or
  DRAFT state, skipped/blocked requirements, Definition of Done status, and
  final main-agent acceptance.
