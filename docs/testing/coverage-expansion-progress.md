# Coverage Expansion Progress

## Branch

- `chore/test-coverage-expansion`

## Goal

Increase automated test coverage toward the agreed long-term target of `75%` line coverage in frontend and Rust, while focusing on the highest-risk paths first.

## Status Legend

- `[ ]` not started
- `[-]` in progress
- `[x]` completed
- `[!]` blocked

## Baseline

- Frontend line coverage: `4.19%`
- Rust line coverage: `8.92%`

## Milestones

- [ ] Milestone A: Frontend `10%`, Rust `15%`
- [ ] Milestone B: Frontend `20%`, Rust `25%`
- [ ] Milestone C: Frontend `35%`, Rust `40%`
- [ ] Final target: Frontend `75%`, Rust `75%`

## Phases

### Phase 0. Tracking and setup

- [x] Create a dedicated branch for the initiative
- [x] Create permanent planning document
- [x] Create progress tracker
- [x] Record baseline coverage

### Phase 1. Frontend orchestration coverage

- [-] Expand coverage around `ConnectionNavigator`
- [x] Test startup and connect-on-startup behavior
- [x] Test refresh and navigation guardrails
- [x] Test mutate-vs-read separation in UI orchestration
- [x] Re-measure frontend coverage

### Phase 2. Rust command-layer coverage

- [ ] Expand coverage around `presentation/commands.rs`
- [ ] Test cancellation classification helpers
- [ ] Test event payload mapping helpers
- [ ] Test command-layer input validation helpers
- [ ] Re-measure Rust coverage

### Phase 3. Rust provider-service expansion

- [ ] Expand AWS service coverage beyond current helpers
- [ ] Expand Azure service coverage beyond current helpers
- [ ] Cover delete/restore/tier-change sensitive paths
- [ ] Cover pagination, batching, and chunking rules
- [ ] Re-measure Rust coverage

### Phase 4. Frontend workflow refinement

- [ ] Add coverage for restore-related workflow logic
- [ ] Add coverage for storage-class/tier workflow logic
- [ ] Add coverage for upload conflict decision logic
- [ ] Re-measure frontend coverage

### Phase 5. Policy review

- [ ] Review whether CI should remain monitor-only
- [ ] Update `docs/testing/README.md` with delivered scope changes if needed
- [ ] Summarize remaining high-risk gaps

## Current Priorities

1. `ConnectionNavigator.tsx`
2. `presentation/commands.rs`
3. remaining high-risk AWS/Azure service flows

## Current Risks

- `ConnectionNavigator.tsx` remains the largest uncovered frontend orchestration surface
- `presentation/commands.rs` still has no meaningful unit coverage
- current overall coverage is too low to treat percentage as an enforcement gate

## Notes

- Use this file to record new measured coverage after each phase
- Keep numeric snapshots here, not in the permanent testing guide

## Latest Measurements

- After Phase 1 substep 1:
  - Frontend line coverage: `4.33%`
  - Frontend statements: `4.33%`
  - Frontend branches: `53.04%`
  - Frontend functions: `33.03%`
- After Phase 1 substep 2:
  - Frontend line coverage: `4.59%`
  - Frontend statements: `4.59%`
  - Frontend branches: `57.45%`
  - Frontend functions: `34.21%`
