# Coverage Expansion Plan

## Objective

Increase automated test coverage in CloudEasyFiles in a controlled way, prioritizing risk reduction in critical flows instead of chasing raw percentage alone.

This initiative extends the existing test foundation and focuses on the areas most likely to introduce regressions, unintended provider operations, or broken UI orchestration.

## Coverage Target

The long-term target for this initiative is:

- Frontend: `75%` line coverage
- Rust: `75%` line coverage

This target is intentionally ambitious but still aligned with common market practice. The repository will pursue it in phases, starting from the current baseline rather than trying to force a single large jump.

## Baseline

Current measured baseline at the start of this initiative:

- Frontend: `4.19%` line coverage
- Rust: `8.92%` line coverage

These values are used only as the starting point for this plan. Updated values should be tracked in the progress file, not duplicated across multiple permanent documents.

## Coverage Policy

- Use line coverage as the canonical project-wide metric
- Use branch/function/region coverage as supporting diagnostics
- Keep coverage visible in CI, but do not block pull requests on coverage thresholds yet
- Continue prioritizing critical paths and provider-safety guardrails over broad low-value coverage

## Execution Strategy

### Phase 0. Tracking and branch workflow

- create and use a dedicated branch for the initiative
- track progress in a persistent checklist file
- record coverage before and after each phase

### Phase 1. Frontend orchestration coverage

Primary target:

- `src/features/navigation/ConnectionNavigator.tsx`

Approach:

- keep extracting pure decision logic into focused helpers
- test startup, refresh, navigation, and explicit mutate-vs-read behavior
- test selection, batching, and contextual action eligibility where behavior affects provider operations

Success criteria:

- coverage meaningfully increases around the main navigation/orchestration layer
- tests prove that non-user-triggered flows do not accidentally call mutating operations

### Phase 2. Rust command-layer coverage

Primary target:

- `src-tauri/src/presentation/commands.rs`

Approach:

- test small command-layer helpers directly
- extract pure mapping/validation helpers where necessary
- verify cancellation classification, event mapping, and command/service handoff behavior

Success criteria:

- the Tauri command boundary is protected against contract regressions
- cancellation and error handling rules are covered

### Phase 3. Rust provider-service expansion

Primary targets:

- remaining high-risk paths in AWS and Azure services

Approach:

- extend unit coverage beyond current helper-only tests
- focus on delete, restore, tier change, pagination, chunking, and operation-parameter normalization
- continue avoiding live provider calls in CI

Success criteria:

- more operationally sensitive backend paths are covered
- pagination and batch behavior gain regression protection

### Phase 4. Frontend workflow refinement

Primary targets:

- restore flows
- storage-class/tier flows
- upload conflict decision flows

Approach:

- add tests only where UI logic carries meaningful business or operational behavior
- avoid broad visual snapshots

Success criteria:

- key user decision flows gain automated regression coverage

### Phase 5. Policy review

- re-measure coverage after each phase
- decide whether the project is ready for a soft gate on coverage in CI
- update the testing guide with newly covered areas and commands if needed

## Milestones

Intermediate milestones for this initiative:

- Milestone A: Frontend `10%`, Rust `15%`
- Milestone B: Frontend `20%`, Rust `25%`
- Milestone C: Frontend `35%`, Rust `40%`
- Milestone D: Frontend `50%`, Rust `55%`
- Final target: Frontend `75%`, Rust `75%`

These milestones are for planning and progress tracking only. They are not CI failure thresholds at this stage.

Current milestone status as of 2026-04-23:

- Milestone D is complete: Frontend `53.08%`, Rust `58.99%`
- Frontend final target is complete: `76.90%` after scoping V8 coverage to application source under `src`
- Rust remains at `58.99%`; the next planned work should expand Rust coverage toward the remaining `75%` final target

## Prioritization Rules

When choosing what to test next, prefer:

- code that can trigger provider operations or side effects
- code that distinguishes read-only from mutating flows
- code that translates provider state into product behavior
- code with batching, pagination, retries, cancellation, or state transitions
- code with large orchestration surface and weak existing coverage

Deprioritize:

- purely visual components without meaningful logic
- low-value snapshots
- live cloud tests in the default CI path

## Validation Commands

Use these commands during the initiative:

```bash
npm run check
npm run test
npm run test:frontend:coverage
npm run test:rust:coverage
```

## References

- Google Testing Blog, code coverage best practices
- Atlassian guidance on practical code coverage use
- Codecov guidance against chasing `100%` mechanically
