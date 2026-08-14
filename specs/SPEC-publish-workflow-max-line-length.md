# Publish Workflow Test Line Length

Status: Approved

## Purpose

Remove the ESLint `max-len` warning from the numeric release-tag workflow assertion without changing test behavior.

## Requested Behavior

- Split the 172-character assertion across multiple lines.
- Preserve the assertion source, regular expression, message, and behavior.

## Scope

- `test/publishWorkflow.test.ts`
- Completed-work spec and plan artifacts.

## Out Of Scope

- Changing the publish workflow or release-tag matching behavior.
- Changing ESLint configuration or line-length limits.
- Refactoring other assertions.

## Inputs And Constraints

- The project maximum line length is 160 characters.
- The edit is formatting-only and must preserve the existing test semantics.

## Deterministic Behavior Delivered

The numeric release-tag `assert.match` call is formatted across multiple lines, with every line within the configured limit and no semantic changes.

## Assumptions

Test-first development is not applicable because this is a formatting-only change.

## Impact

The reported `max-len` warning is removed while workflow coverage remains unchanged.

## Validation Performed

- Target-file ESLint check.
- Targeted workflow test.
- Full `npm test`: the changed workflow test passed, but the unrelated `publishForgejoPackage` test file reported a failure.
- `git diff --check`.

## Validation Skipped

- Build and prepublish validation because the `super-agent` workflow permits only short validation.
- Independent QA and code review, as required by the `super-agent` workflow.

## Documentation Changes

No user-facing documentation changed.
