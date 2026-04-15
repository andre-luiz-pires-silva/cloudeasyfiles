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

- [x] Milestone A: Frontend `10%`, Rust `15%`
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

- [-] Expand coverage around `presentation/commands.rs`
- [x] Test cancellation classification helpers
- [x] Test event payload mapping helpers
- [x] Test command-layer input validation helpers
- [x] Re-measure Rust coverage

### Phase 3. Rust provider-service expansion

- [x] Expand AWS service coverage beyond current helpers
- [x] Expand Azure service coverage beyond current helpers
- [x] Cover delete/restore/tier-change sensitive paths
- [x] Cover pagination, batching, and chunking rules
- [x] Re-measure Rust coverage

### Phase 4. Frontend workflow refinement

- [x] Add coverage for restore-related workflow logic
- [x] Add coverage for storage-class/tier workflow logic
- [x] Add coverage for upload conflict decision logic
- [x] Re-measure frontend coverage

### Phase 5. Policy review

- [x] Review whether CI should remain monitor-only
- [x] Update `docs/testing/README.md` with delivered scope changes if needed
- [x] Summarize remaining high-risk gaps

## Current Priorities

1. `ConnectionNavigator.tsx`
2. `presentation/commands.rs`
3. remaining high-risk AWS/Azure service flows

## Current Risks

- `ConnectionNavigator.tsx` remains the largest uncovered frontend orchestration surface
- upload command/event paths in `presentation/commands.rs` are still only partially covered
- current overall coverage is still too low to justify a hard or soft coverage gate

## Policy Decision

- Coverage remains `monitor-only` in CI for now.
- Reason: Rust coverage has crossed the first backend milestone threshold, but frontend coverage is still well below Milestone A and the remaining work is concentrated in high-risk orchestration code rather than broad low-value files.
- Revisit coverage gating after the next frontend-heavy iteration.

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
- After Phase 4 substep 1:
  - Frontend line coverage: `5.56%`
  - Frontend statements: `5.56%`
  - Frontend branches: `61.16%`
  - Frontend functions: `36.97%`
- After Phase 4 substep 2:
  - Frontend line coverage: `6.00%`
  - Frontend statements: `6.00%`
  - Frontend branches: `63.44%`
  - Frontend functions: `38.01%`
- After Phase 1 substep 3:
  - Frontend line coverage: `6.20%`
  - Frontend statements: `6.20%`
  - Frontend branches: `65.06%`
  - Frontend functions: `38.52%`
- After Phase 1 substep 4:
  - Frontend line coverage: `6.94%`
  - Frontend statements: `6.94%`
  - Frontend branches: `67.64%`
  - Frontend functions: `40.00%`
- After Phase 1 substep 5:
  - Frontend line coverage: `7.74%`
  - Frontend statements: `7.74%`
  - Frontend branches: `69.72%`
  - Frontend functions: `42.30%`
- After Phase 1 substep 6:
  - Frontend line coverage: `9.42%`
  - Frontend statements: `9.42%`
  - Frontend branches: `70.22%`
  - Frontend functions: `47.91%`
- After Phase 1 substep 7:
  - Frontend line coverage: `10.23%`
  - Frontend statements: `10.23%`
  - Frontend branches: `72.84%`
  - Frontend functions: `50.33%`
- After Phase 1 substep 8:
  - Frontend line coverage: `10.87%`
  - Frontend statements: `10.87%`
  - Frontend branches: `74.15%`
  - Frontend functions: `50.98%`
- After Phase 1 substep 9:
  - Frontend line coverage: `11.14%`
  - Frontend statements: `11.14%`
  - Frontend branches: `75.00%`
  - Frontend functions: `51.92%`
- After Phase 2 substep 1:
  - Rust line coverage: `10.72%`
  - Rust regions: `11.75%`
  - Rust functions: `11.38%`
  - `presentation/commands.rs` line coverage: `6.39%`
- After Phase 2 substep 2:
  - Rust line coverage: `12.50%`
  - Rust regions: `13.10%`
  - Rust functions: `12.24%`
  - `presentation/commands.rs` line coverage: `13.14%`
- After Phase 3 substep 1:
  - Rust line coverage: `15.91%`
  - Rust regions: `17.37%`
  - Rust functions: `17.12%`
  - `aws_connection_service.rs` line coverage: `12.89%`
  - `azure_connection_service.rs` line coverage: `23.46%`
- After Phase 3 substep 2:
  - Rust line coverage: `17.57%`
  - Rust regions: `19.13%`
  - Rust functions: `18.30%`
  - `aws_connection_service.rs` line coverage: `14.91%`
  - `azure_connection_service.rs` line coverage: `26.23%`
- After Phase 3 substep 3:
  - Rust line coverage: `18.60%`
  - Rust regions: `20.73%`
  - Rust functions: `19.75%`
  - `aws_connection_service.rs` line coverage: `16.21%`
  - `azure_connection_service.rs` line coverage: `27.88%`
- After Phase 2 substep 3:
  - Rust line coverage: `19.97%`
  - Rust regions: `21.69%`
  - Rust functions: `20.25%`
  - `presentation/commands.rs` line coverage: `18.36%`
- After Phase 2 substep 4:
  - Rust line coverage: `21.93%`
  - Rust regions: `23.31%`
  - Rust functions: `20.86%`
  - `presentation/commands.rs` line coverage: `25.28%`
