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
- [x] Milestone B: Frontend `20%`, Rust `25%`
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
2. remaining upload orchestration still embedded in `ConnectionNavigator.tsx`
3. higher-level `Window`-driven flows in `presentation/commands.rs`

## Current Risks

- `ConnectionNavigator.tsx` remains the largest uncovered frontend orchestration surface
- upload and transfer orchestration still has meaningful behavior split between extracted helpers and component-local async flows
- higher-level `Window`-driven command flows in `presentation/commands.rs` are still only partially covered

## Policy Decision

- Coverage remains `monitor-only` in CI for now.
- Reason: frontend and Rust have both crossed Milestone B, but the remaining uncovered surface is still concentrated in high-risk orchestration code rather than broad low-value files, especially `ConnectionNavigator.tsx` and `presentation/commands.rs`.
- Revisit coverage gating after the next orchestration-focused frontend and command-layer iteration.

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
- After Phase 1 substep 10:
  - Frontend line coverage: `11.69%`
  - Frontend statements: `11.69%`
  - Frontend branches: `75.51%`
  - Frontend functions: `53.98%`
- After Phase 1 substep 11:
  - Frontend line coverage: `12.27%`
  - Frontend statements: `12.27%`
  - Frontend branches: `76.77%`
  - Frontend functions: `55.08%`
- After Phase 1 substep 12:
  - Frontend line coverage: `13.14%`
  - Frontend statements: `13.14%`
  - Frontend branches: `77.19%`
  - Frontend functions: `57.14%`
- After Phase 1 substep 13:
  - Frontend line coverage: `14.06%`
  - Frontend statements: `14.06%`
  - Frontend branches: `77.55%`
  - Frontend functions: `59.78%`
- After Phase 1 substep 14:
  - Frontend line coverage: `14.83%`
  - Frontend statements: `14.83%`
  - Frontend branches: `78.30%`
  - Frontend functions: `59.89%`
- After Phase 1 substep 15:
  - Frontend line coverage: `15.59%`
  - Frontend statements: `15.59%`
  - Frontend branches: `79.52%`
  - Frontend functions: `61.08%`
- After Phase 1 substep 16:
  - Frontend line coverage: `15.86%`
  - Frontend statements: `15.86%`
  - Frontend branches: `80.10%`
  - Frontend functions: `61.65%`
- After Phase 1 substep 17:
  - Frontend line coverage: `16.26%`
  - Frontend statements: `16.26%`
  - Frontend branches: `80.58%`
  - Frontend functions: `62.91%`
- After Phase 1 substep 18:
  - Frontend line coverage: `16.60%`
  - Frontend statements: `16.60%`
  - Frontend branches: `81.00%`
  - Frontend functions: `63.59%`
- After Phase 1 substep 19:
  - Frontend line coverage: `17.54%`
  - Frontend statements: `17.54%`
  - Frontend branches: `80.13%`
  - Frontend functions: `64.88%`
- After Phase 1 substep 20:
  - Frontend line coverage: `18.01%`
  - Frontend statements: `18.01%`
  - Frontend branches: `80.35%`
  - Frontend functions: `65.35%`
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
- After Phase 2 substep 5:
  - Rust line coverage: `23.72%`
  - Rust regions: `24.75%`
  - Rust functions: `21.46%`
  - `presentation/commands.rs` line coverage: `31.11%`
- After Phase 2 substep 6:
  - Rust line coverage: `25.65%`
  - Rust regions: `26.33%`
  - Rust functions: `22.05%`
  - `presentation/commands.rs` line coverage: `36.75%`
- After Phase 3 substep 4:
  - Rust line coverage: `31.21%`
- After frontend wrapper-contract expansion:
  - Frontend line coverage: `25.71%`
  - Frontend statements: `25.71%`
  - Frontend branches: `87.30%`
  - Frontend functions: `78.49%`
  - Delivered:
    - `src/lib/tauri/awsConnections.ts` line coverage: `100%`
    - `src/lib/tauri/azureConnections.ts` line coverage: `100%`
    - `src/lib/tauri/commands.ts` line coverage: `100%`
    - `src/lib/tauri/connectionSecrets.ts` line coverage: `100%`
- After frontend derived-state extraction:
  - Frontend line coverage: `26.33%`
  - Frontend statements: `26.33%`
  - Frontend branches: `87.67%`
  - Frontend functions: `78.81%`
  - Delivered:
    - extracted and covered `src/features/navigation/navigationDerivedState.ts`
    - reduced inline filtering/counting logic inside `ConnectionNavigator.tsx`
- After frontend transfer/cache/upload-preflight extraction:
  - Frontend line coverage: `26.61%`
  - Frontend statements: `26.61%`
  - Frontend branches: `87.74%`
  - Frontend functions: `79.12%`
  - Delivered:
    - extracted and covered `src/features/navigation/navigationCacheState.ts`
    - expanded `src/features/navigation/navigationTransfers.ts` coverage for cancellation routing
    - expanded `src/features/navigation/navigationUploadPreparation.ts` coverage for issue messaging and provider preflight existence checks
- After frontend upload-execution extraction:
  - Frontend line coverage: `27.72%`
  - Frontend statements: `27.72%`
  - Frontend branches: `88.00%`
  - Frontend functions: `79.42%`
  - Delivered:
    - extracted and covered `src/features/navigation/navigationUploadExecution.ts`
    - reduced provider-aware upload branching inside `ConnectionNavigator.tsx`
    - covered file-path versus byte-upload source selection for dropped files
- After frontend connection-action execution extraction:
  - Frontend line coverage: `27.88%`
  - Frontend statements: `27.88%`
  - Frontend branches: `87.95%`
  - Frontend functions: `79.56%`
  - Delivered:
    - expanded `src/features/navigation/navigationActionDispatch.ts` to cover ordered execution helpers
    - reduced connection-action execution branching inside `ConnectionNavigator.tsx`
- After frontend content-area action execution extraction:
  - Frontend line coverage: `27.93%`
  - Frontend statements: `27.93%`
  - Frontend branches: `87.98%`
  - Frontend functions: `79.64%`
  - Delivered:
    - expanded `src/features/navigation/navigationActionDispatch.ts` to cover content-area action execution
    - reduced content-area menu branching inside `ConnectionNavigator.tsx`
- After frontend workflow-modal close-state extraction:
  - Frontend line coverage: `28.09%`
  - Frontend statements: `28.09%`
  - Frontend branches: `88.03%`
  - Frontend functions: `79.78%`
  - Delivered:
    - expanded `src/features/navigation/navigationWorkflows.ts` to cover restore/change-tier modal close-state helpers
    - reduced restore/change-tier modal lifecycle branching inside `ConnectionNavigator.tsx`
- After frontend file-input extraction:
  - Frontend line coverage: `28.22%`
  - Frontend statements: `28.22%`
  - Frontend branches: `87.95%`
  - Frontend functions: `79.92%`
  - Delivered:
    - extracted and covered `src/features/navigation/navigationFileInput.ts`
    - reduced drag-and-drop and directory-picker normalization branching inside `ConnectionNavigator.tsx`
  - Rust regions: `31.02%`
  - Rust functions: `26.11%`
  - `aws_connection_service.rs` line coverage: `24.64%`
  - `azure_connection_service.rs` line coverage: `36.86%`
- After Phase 3 substep 5:
  - Rust line coverage: `35.52%`
  - Rust regions: `35.59%`
  - Rust functions: `30.44%`
  - `aws_connection_service.rs` line coverage: `31.41%`
  - `azure_connection_service.rs` line coverage: `43.25%`
- After Phase 3 substep 6:
  - Rust line coverage: `37.78%`
  - Rust regions: `38.07%`
  - Rust functions: `31.68%`
  - `aws_connection_service.rs` line coverage: `34.96%`
  - `azure_connection_service.rs` line coverage: `46.43%`
- After Phase 3 substep 7:
  - Rust line coverage: `39.51%`
  - Rust regions: `39.35%`
  - Rust functions: `33.24%`
  - `aws_connection_service.rs` line coverage: `37.53%`
  - `azure_connection_service.rs` line coverage: `48.95%`
- After Phase 2 substep 7:
  - Rust line coverage: `42.16%`
  - Rust regions: `41.42%`
  - Rust functions: `36.69%`
  - `presentation/commands.rs` line coverage: `45.68%`
- After Phase 2 substep 8:
  - Rust line coverage: `42.71%`
  - Rust regions: `42.06%`
  - Rust functions: `37.16%`
  - `presentation/commands.rs` line coverage: `47.37%`
