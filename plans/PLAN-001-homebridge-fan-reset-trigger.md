# PLAN-001 - Homebridge Fan Reset Trigger

Status: Approved
Date: 2026-08-10

## Approved Spec

- `specs/SPEC-001-homebridge-fan-reset-trigger.md`
- Spec status verified as `Approved` before this plan was created.

## Objective

Implement the approved momentary HomeKit reset Switch against the existing
Device Integration API reset contract, replace the template demonstration
behavior, validate the result deterministically, and deliver every accepted
in-scope artifact in a pushed implementation commit.

## Implementation Context Boundary

- Implementation must begin in a fresh session, after context is cleared, or
  after the user explicitly confirms same-context implementation.
- The implementation session must ingest only repository/workspace instructions,
  the approved spec and plan, current branch/worktree state, the files listed in
  this plan, and minimal local edit patterns.
- Product research, architecture research, scope discovery, plan discovery, and
  changes to the Device Integration API are prohibited during implementation.
- The OpenAPI operation at
  `/home/alexbanica/workspace/device-integration-api/openapi/device-integration-api.openapi.yaml`
  and its approved `SPEC-007` are read-only contract inputs. If their reset
  method, path, request, response, or authentication contract differs at
  implementation time, stop for a spec/plan amendment.
- Any missing, ambiguous, incorrect, or materially different behavior discovered
  during implementation requires stopping for an approved artifact amendment.

## Branch And Worktree Policy

- The researched base is local `latest` tracking `origin/latest` at `e433b62`.
- At implementation start, fetch `origin` and verify that `latest` is still the
  intended base and that unrelated worktree changes are identified and
  preserved.
- Create and use `feature/homebridge-fan-reset-trigger` from the verified
  `latest` base. Do not implement on `latest`.
- If the current branch is not the expected base, the base has diverged, or an
  existing branch of that name has ambiguous work, stop and ask before changing
  branch state.
- Subagents must not create or switch branches, commit, or push. They are not
  alone in the worktree and must preserve and accommodate edits made by other
  units.

## Intended Architecture And Affected Files

### Approved artifacts

- `specs/SPEC-001-homebridge-fan-reset-trigger.md`: retain the approved behavior
  contract and include it in delivery.
- `plans/PLAN-001-homebridge-fan-reset-trigger.md`: retain the approved execution
  contract and include it in delivery.

### Test harness

- `package.json`: add a deterministic `test` script without changing runtime
  dependencies or package identity.
- `tsconfig.test.json`: compile production and test TypeScript into an isolated
  `.test-dist` tree before invoking Node's built-in test runner.
- `.gitignore`: exclude `.test-dist/` generated test output.
- `package-lock.json`: expected unchanged because the plan adds no dependency;
  reconcile it if npm changes it unexpectedly.

### Application and infrastructure

- `src/fan/services/FanResetGatewayInterface.ts`: inward reset gateway contract,
  independent of Homebridge and HTTP runtime details.
- `src/fan/services/FanResetServiceInterface.ts`: inward reset use-case contract.
- `src/fan/services/FanResetService.ts`: reset orchestration and single in-flight
  request coalescing, with no Homebridge or HTTP dependency.
- `src/fan/infrastructures/DeviceIntegrationApiFanResetGateway.ts`: API-base-URL
  normalization and validation, exact bodyless POST contract, five-second
  timeout, exact `202` success rule, and infrastructure error conversion.

### Homebridge adapters and configuration

- `src/platform.ts`: validate/default platform configuration, compose the
  infrastructure and application layers, discover exactly one stable accessory,
  restore it without duplication, and remove cached example accessories.
- `src/platformAccessory.ts`: replace example Lightbulb/Brightness/MotionSensor
  behavior with one momentary Switch adapter, map ON/OFF writes, update pending
  and idle characteristic state, log outcomes, and translate contained failures
  to HomeKit service communication errors.
- `src/index.ts`: update only internal platform class wiring if the example class
  is renamed; retain the public platform identifier.
- `config.schema.json`: add optional `apiBaseUrl` with the approved default and
  URI constraints, update user-facing names/descriptions, and keep the public
  `pluginAlias` unchanged.
- `src/settings.ts`: expected unchanged because public identifiers are out of
  scope; change only if an internal stable accessory identifier belongs here and
  does not alter the public plugin/platform names.

### Deterministic tests

- `test/deviceIntegrationApiFanResetGateway.test.ts`: URL/default/path/method/body,
  timeout, network failure, and exact-status contract tests using a local HTTP
  server or injected deterministic boundary.
- `test/fanResetService.test.ts`: one-in-flight coalescing, repeat activation,
  failure recovery, and gateway-result propagation tests.
- `test/platformAccessory.test.ts`: Switch initial/pending/final state, OFF no-op,
  success logging, and HomeKit error translation tests with deterministic fakes.
- `test/platform.test.ts`: configuration default/rejection, stable discovery,
  cached restoration, and example-accessory removal tests.
- `test/hbConfig/**`: machine-specific ignored Homebridge runtime configuration;
  do not edit or include it in delivery.

### Documentation

- `README.md`: replace template documentation with plugin configuration, reset
  trigger semantics, endpoint contract, network reachability, failure behavior,
  validation commands, and the explicit application-state-only limitation.
- `AGENTS.md`: expected unchanged because repository architecture and workflow do
  not change; update only if implementation proves a current file-boundary note
  factually stale without expanding agent policy.

## Test Strategy

- Test-first applies because request coalescing, API contract enforcement,
  HomeKit state transitions, and failure recovery are testable behavior.
- Use existing TypeScript and Node tooling; do not add a test framework or new
  package dependency.
- The intended `npm test` pipeline is equivalent to:
  `rimraf ./.test-dist && tsc -p tsconfig.test.json && node --test .test-dist/test/*.test.js`.
- Each test-focused unit must demonstrate the expected failing state before its
  corresponding production unit begins. A compile failure caused by the planned
  missing production symbol is acceptable evidence for the initial red state.
- Tests must use local fakes or a loopback HTTP server. They must not contact a
  live Device Integration API, Homebridge instance, HomeKit home, or external
  network.

## Dependency-Aware Work Graph

Maximum planned concurrency is one developer for test-harness setup, then four
test-writers, two production developers, and three code reviewers. At no point
may more than four test-focused, two developer, or three code-review subagents be
active. Every assignment is sized for no more than five minutes of active work.

### H0 - Deterministic test harness

- Type: development; test-first not applicable because this unit adds test
  execution tooling only and changes no product behavior.
- Agent: one clean-context `developer` subagent.
- Boundary: Node/TypeScript test execution only.
- Owned files: `package.json`, `tsconfig.test.json`, `.gitignore`.
- Dependencies: approved spec and approved plan.
- Acceptance: `npm test` discovers compiled `test/*.test.ts` files when present,
  generated output is ignored, no new package dependency is introduced, and
  existing build/lint scripts remain intact.
- Validation: inspect package diff; run an empty/discovery-safe test invocation as
  applicable; `npm run build`; `git diff --check`.

### T1 - Device Integration API gateway tests

- Type: test-first.
- Agent: one clean-context `test-writer` subagent.
- Boundary: outbound reset HTTP contract and base-URL validation.
- Owned file: `test/deviceIntegrationApiFanResetGateway.test.ts`.
- Dependencies: H0.
- Acceptance: failing tests cover omitted default, valid/trailing-slash base URLs,
  invalid origins, exact path/method/no-body request, `202` success, non-`202`
  failure, timeout, and network failure without external traffic.
- Validation: focused compiled Node test invocation; record the intentional red
  result before D1 begins.

### T2 - Reset application service tests

- Type: test-first.
- Agent: one clean-context `test-writer` subagent.
- Boundary: reset use-case orchestration independent of HTTP and Homebridge.
- Owned file: `test/fanResetService.test.ts`.
- Dependencies: H0.
- Acceptance: failing tests cover one call while idle, concurrent calls sharing
  one in-flight request, later calls producing new requests, error propagation,
  and recovery after failure.
- Validation: focused compiled Node test invocation; record the intentional red
  result before D2 begins.

### T3A - Homebridge Switch adapter tests

- Type: test-first.
- Agent: one clean-context `test-writer` subagent.
- Boundary: momentary Switch state and HomeKit failure mapping only.
- Owned file: `test/platformAccessory.test.ts`.
- Dependencies: H0.
- Acceptance: failing deterministic tests cover initial OFF, pending ON, final
  OFF after success/failure, OFF no-op, duplicate ON behavior through the
  application contract, logging, and HAP communication failure.
- Validation: focused compiled Node test invocation; record the intentional red
  result before D3A begins.

### T3B - Homebridge platform lifecycle tests

- Type: test-first.
- Agent: one clean-context `test-writer` subagent.
- Boundary: configuration, accessory identity, discovery, restoration, and cache
  reconciliation only.
- Owned file: `test/platform.test.ts`.
- Dependencies: H0.
- Acceptance: failing deterministic tests cover default/invalid configuration,
  one stable reset accessory, restoration without duplication, and removal of
  cached example accessories.
- Validation: focused compiled Node test invocation; record the intentional red
  result before D3B begins.

### D1 - HTTP gateway implementation

- Type: development.
- Agent: one clean-context `developer` subagent.
- Boundary: inward gateway contract and Device Integration API HTTP adapter only.
- Owned files: `src/fan/services/FanResetGatewayInterface.ts`,
  `src/fan/infrastructures/DeviceIntegrationApiFanResetGateway.ts`.
- Dependencies: T1 complete.
- Acceptance: T1 passes with exact bodyless POST, exact `202` success, approved
  URL/default/timeout behavior, no retry, and contained typed errors; source has
  no Homebridge dependency.
- Validation: focused T1 tests, `npm run lint`, `npm run build`,
  `git diff --check`.

### D2 - Reset service implementation

- Type: development.
- Agent: one clean-context `developer` subagent.
- Boundary: application reset use case and concurrency only.
- Owned files: `src/fan/services/FanResetServiceInterface.ts`,
  `src/fan/services/FanResetService.ts`.
- Dependencies: T2 complete.
- Acceptance: T2 passes; concurrent calls share one request, settlement clears
  in-flight state, later calls can run, and failures remain retryable; source has
  no Homebridge or HTTP dependency.
- Validation: focused T2 tests, `npm run lint`, `npm run build`,
  `git diff --check`.

### D3A - Homebridge Switch adapter

- Type: development.
- Agent: one clean-context `developer` subagent.
- Boundary: momentary Switch adapter and HomeKit error translation only.
- Owned file: `src/platformAccessory.ts`.
- Dependencies: T3A and D2 complete.
- Acceptance: T3A passes; the accessory has one Switch, reports the approved
  initial/pending/final states, OFF is a no-op, failures become HAP communication
  failures, and example Lightbulb/Brightness/MotionSensor behavior is absent.
- Validation: focused T3A tests, `npm run lint`, `npm run build`,
  `git diff --check`.

### D3B - Homebridge composition and lifecycle

- Type: development.
- Agent: one clean-context `developer` subagent.
- Boundary: platform composition, dynamic accessory lifecycle, runtime
  configuration, and schema alignment.
- Owned files: `src/platform.ts`, `src/index.ts`, `src/settings.ts` if needed
  within the stated constraint, and `config.schema.json`.
- Dependencies: T3B, D1, D2, and D3A complete.
- Acceptance: T3B and the full test suite pass; one stable reset accessory is
  exposed for valid/default configuration, invalid supplied URLs are contained,
  cached template accessories are removed, public identifiers remain unchanged,
  and the platform composes only inward contracts with infrastructure adapters.
- Validation: focused T3B tests, `npm test`, `npm run lint`, `npm run build`,
  `git diff --check`.

### D4 - User documentation

- Type: documentation; test-first not applicable because this unit documents the
  already tested final behavior and changes no runtime behavior.
- Agent: one clean-context `developer` subagent after production integration.
- Boundary: user-facing setup and behavior documentation only.
- Owned file: `README.md`; `AGENTS.md` only under the constrained exception above.
- Dependencies: D3B complete and final runtime/config names confirmed from the
  approved implementation.
- Acceptance: template content is replaced; documented properties, defaults,
  request meaning, network requirement, errors, limitations, and commands match
  code and schema exactly.
- Validation: compare README examples to `config.schema.json`; run
  `git diff --check`.

### R1 - Application and HTTP contract review

- Type: independent code review; no edits.
- Agent: one clean-context `code-reviewer` subagent.
- Boundary: D1/D2 source and T1/T2 tests.
- Owned review scope: gateway URL/method/body/status/timeout behavior, concurrency,
  onion dependency direction, determinism, test adequacy, spec/plan agreement,
  and regressions.
- Dependencies: D1 and D2 complete.
- Acceptance: concise findings with severity, exact locations, spec/plan mapping,
  and remaining review scope; no production changes.
- Validation: inspect focused diff and focused test results.

### R2A - Homebridge Switch review

- Type: independent code review; no edits.
- Agent: one clean-context `code-reviewer` subagent.
- Boundary: D3A source and T3A tests.
- Owned review scope: characteristic transitions, HAP error translation,
  unhandled rejection risk, application-contract usage, test adequacy, and
  spec/plan agreement.
- Dependencies: D3A complete.
- Acceptance: concise findings with severity, exact locations, spec/plan mapping,
  and remaining review scope; no production changes.
- Validation: inspect focused diff and focused/full validation results.

### R2B - Platform lifecycle and documentation review

- Type: independent code review; no edits.
- Agent: one clean-context `code-reviewer` subagent.
- Boundary: D3B/D4 source, T3B tests, schema, and documentation.
- Owned review scope: cached accessory reconciliation, composition direction,
  config/schema agreement, public-identifier preservation, docs accuracy, test
  adequacy, and spec/plan agreement.
- Dependencies: D3B and D4 complete.
- Acceptance: concise findings with severity, exact locations, spec/plan mapping,
  and remaining review scope; no production changes.
- Validation: inspect focused diff and focused/full validation results.

### F - Review and QA fixes

- Type: conditional development.
- Agent: a new clean-context `developer` subagent for each non-overlapping fix
  boundary; never a reviewer editing its own finding.
- Boundary and owned files: assigned by the main agent from a specific
  R1/R2A/R2B or QA finding and restricted to the smallest non-overlapping
  affected files.
- Dependencies: corresponding R1/R2A/R2B or main-agent QA finding.
- Acceptance: finding is resolved inside approved scope, affected tests pass,
  and the relevant reviewer scope is rechecked when material.
- Validation: focused tests plus all validation affected by the fix.

## Shared-File And Integration Rules

- H0 exclusively owns the test harness files; later units must not modify them
  without main-agent serialization and a recorded reason.
- D1 and D2 own non-overlapping inward/application and infrastructure files and
  may run concurrently after their own test units complete.
- D3A may start as soon as T3A and D2 complete while D1 is still active because
  its ownership is independent. D3B is serialized after D1/D2/D3A because it
  imports and composes all three boundaries.
- T3A and T3B exclusively own their separate Homebridge test files; D3A and D3B
  may read but must not rewrite tests merely to fit implementation.
- The main agent supervises the graph, inspects every handoff and worktree diff,
  and stops any active subagent at five minutes. A timed-out unit must be reported,
  preserved, and split into smaller non-overlapping work before reassignment.
- The main agent may integrate only completed-unit boundaries. Behavior or scope
  changes require artifact amendment rather than an integration workaround.

## Main-Agent QA

The main agent, not a QA subagent, must:

1. Re-read the approved spec and plan and map every acceptance criterion to code,
   tests, documentation, or an explicitly unavailable runtime check.
2. Inspect the complete unstaged and staged diff for example-code remnants,
   accidental public-identifier changes, generated output, secrets,
   machine-specific configuration, and edits outside the approved paths.
3. Run `npm test`.
4. Run `npm run lint`.
5. Run `npm run build`.
6. Run `npm run prepublishOnly`.
7. Run `git diff --check` and, after staging, `git diff --cached --check`.
8. Verify test requests use loopback only and that no test or implementation
   contacts a live API during QA.
9. Confirm errors and rejected promises are contained and the Switch returns OFF
   after every tested result.
10. Confirm schema, runtime defaults, README, and example configuration agree.

Starting Homebridge, interacting with a HomeKit home, or calling a live Device
Integration API is operational validation and must not occur without explicit
user authorization and target confirmation. If unavailable or user-owned, list
it as not run and keep delivery DRAFT because runtime/UI behavior remains
unverified.

## Documentation And Contract Policy

- Update only Homebridge repository documentation and configuration artifacts
  listed above.
- Do not edit the upstream OpenAPI document, API spec, API source, or API tests;
  the public API contract is already implemented and is consumed read-only.
- Document that reset updates/persists API application state only and does not
  issue an IR command or prove physical fan state.
- Do not add documentation churn to `AGENTS.md` unless its existing architecture
  boundary becomes factually stale due to an approved file rename.

## Commit, Push, And Completion

- Before staging, reconcile every modified, added, deleted, renamed, and untracked
  path with `git status`; classify unrelated user changes and preserve them.
- Stage every accepted in-scope path, including the approved spec, approved plan,
  production code, deterministic tests, configuration, and documentation.
- Inspect `git diff --cached --name-status`, the complete staged diff, and
  `git diff --cached --check` before committing.
- Use one project-convention commit: `feature: Add Homebridge fan reset trigger`
  when all required validation including authorized runtime/UI validation passes;
  otherwise use `feature: DRAFT add Homebridge fan reset trigger` and list every
  unavailable validation boundary.
- Push `feature/homebridge-fan-reset-trigger` to `origin` and verify it tracks its
  upstream and is no longer ahead after the push.
- After committing and pushing, inspect `git status --short --branch` again. Do
  not report completion if an accepted in-scope change is uncommitted, unpushed,
  hidden, or omitted.
- The completion report must state implementation summary, review/QA findings,
  resolved findings, validation run/not run, risks and limitations,
  documentation, commit/push status, final or DRAFT delivery, skipped or blocked
  requirements, Definition of Done status, and final main-agent acceptance.
