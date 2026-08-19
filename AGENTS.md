# AGENTS

## Domain-only test policy

- Automated tests of any kind, including unit, integration, contract, snapshot,
  workflow, and configuration tests, may be created or maintained only for
  deterministic domain source logic in this project.
- Do not create or maintain tests for anything outside domain source logic,
  including application orchestration, infrastructure and adapters,
  presentation, UI and controllers, Docker or container files, GitHub Actions
  or other CI/CD workflows, deployment and configuration, packaging and release
  scripts, tooling, or other operational code.
- Validate non-domain changes with appropriate static, syntax, lint, type,
  structural, build, dry-run, smoke, runtime, or operator checks instead of
  automated tests.
- If this project has no domain source logic, automated testing and test-first
  work are not applicable.
- This policy supersedes any more general testing or validation wording
  elsewhere in this file.

## Scope
This repository is a TypeScript Homebridge dynamic platform plugin for exposing an IR-controlled fan accessory.

## Workflow
- Read `~/workspace.md` before implementation work.
- Behavior changes require an approved spec before implementation.
- Keep Homebridge/HomeKit behavior deterministic and avoid unhandled plugin exceptions.
- Do not commit local Homebridge runtime state, secrets, or machine-specific config.

## Project Architecture
- The project is implemented with Domain Driven Design and onion architecture within the current Homebridge template shape.
- Dependency direction is inward: Homebridge platform/accessory adapters depend on domain/application contracts; domain concepts must stay independent of Homebridge APIs, plugin registration, filesystem, and runtime logging concerns.
- `src/index.ts`: plugin registration boundary.
- `src/settings.ts`: plugin and platform identifiers used by Homebridge and config schema.
- `src/platform.ts`: dynamic platform adapter for config loading, accessory discovery, and accessory registration.
- `src/platformAccessory.ts`: HomeKit accessory/service adapter and characteristic handling.
- `src/@types`: local type declarations for third-party packages that do not provide project-sufficient types.
- `config.schema.json`: Homebridge UI/config contract and must stay aligned with platform settings.
- `dist/` is generated build output and should not be edited by hand.

## Naming Standards
- Interfaces are suffixed with `Interface`.
- Abstract classes are prefixed with `Abstract`.
- Implementations of abstract classes remove the `Abstract` prefix and keep the remaining name.
- Service implementations match interface names without suffix.

## Validation
- Build with `npm run build`.
- Lint with `npm run lint`.
- `npm run prepublishOnly` runs lint plus build before publishing.
- Use `npm run watch` only for local linked Homebridge development.
