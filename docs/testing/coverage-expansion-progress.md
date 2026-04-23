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
- [x] Milestone C (Rust): Rust `40%` reached — `46.83%` measured after Step R2
- [x] Milestone C (Frontend): Frontend `35%` reached — `36.39%` measured after component render tests
- [x] Milestone D: Frontend `50%`, Rust `55%` reached — Frontend `53.08%`, Rust `58.99%` measured after Step R6
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

- [x] Expand coverage around `presentation/commands.rs`
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

1. **Frontend ConnectionNavigator home coverage added** ✅ — Frontend `62.77%`, Rust `58.99%` measured on 2026-04-23
2. Frontend is close to the next interim `65%` target after initial `ConnectionNavigator.tsx` render/guard coverage
3. Next executable priority: add one focused `ConnectionNavigator.tsx` connected-state render/guard step to cross `65%`

## Operational Roadmap

Use the checklist below as the next execution guide for the coverage-expansion branch. Each step should end with:

- targeted tests passing for the touched area
- `npm run build` or `cargo check` passing
- updated measurements in this file
- one dedicated commit for that step

### Near-Term Frontend Steps

- [x] Step F1. Extract visible-selection and batch-selection state transitions from `ConnectionNavigator.tsx`
- [x] Step F2. Extract restore-modal open-state orchestration from `ConnectionNavigator.tsx`
- [x] Step F3. Extract change-tier modal open-state orchestration from `ConnectionNavigator.tsx`
- [x] Step F4. Extract batch-download orchestration planning from `ConnectionNavigator.tsx`
- [x] Step F5. Extract delete success/error state transitions from `ConnectionNavigator.tsx`
- [x] Step F6. Finish cache-directory picker and local file-input orchestration cleanup
- [x] Step F7. Revisit remaining content filter/counter glue still embedded in `ConnectionNavigator.tsx`
- [x] Step F8. Add app shell, provider, error-boundary, and i18n coverage
- [x] Step F9. Begin `ConnectionNavigator.tsx` render/guard coverage toward frontend `65%`
- [ ] Step F10. Add `ConnectionNavigator.tsx` connected-state render/guard coverage to cross frontend `65%`

### Near-Term Rust Steps

- [x] Step R1. Expand `presentation/commands.rs` coverage for higher-level `Window`-driven command flows
- [x] Step R2. Expand `presentation/commands.rs` coverage for upload/download command-service handoff flows
- [x] Step R3. Expand Rust app/provider helper coverage for bootstrap reload decisions, window-state JSON contracts, and AWS provider error formatting
- [x] Step R4. Expand remaining Rust provider mutation/error-path coverage toward `55%`
- [x] Step R5. Continue Rust provider mutation/error-path coverage toward `55%`
- [x] Step R6. Cross Rust `55%` with one more provider/command coverage step

### Review Step

- [x] Step V1. Re-measure milestone status after F1-F7 and R1-R2, then decide whether Milestone C is reached

## Estimated Remaining Work

- Milestone C (`35%` frontend, `40%` Rust) is complete.
- Next estimate should be set after choosing the next milestone target.

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
- After frontend selection-state extraction:
  - Frontend line coverage: `28.46%`
  - Frontend statements: `28.46%`
  - Frontend branches: `88.10%`
  - Frontend functions: `80.27%`
  - Delivered:
    - completed roadmap Step `F1`
    - extracted and covered `src/features/navigation/navigationSelectionState.ts`
    - reduced visible-selection and batch-selection state branching inside `ConnectionNavigator.tsx`
- After frontend restore-modal open-state extraction:
  - Frontend line coverage: `28.57%`
  - Frontend statements: `28.57%`
  - Frontend branches: `88.13%`
  - Frontend functions: `80.34%`
  - Delivered:
    - completed roadmap Step `F2`
    - expanded `src/features/navigation/navigationWorkflows.ts` to cover restore-modal open-state helpers
    - reduced restore-modal opening branching inside `ConnectionNavigator.tsx`
- After frontend change-tier modal open-state extraction:
  - Frontend line coverage: `28.67%`
  - Frontend statements: `28.67%`
  - Frontend branches: `88.16%`
  - Frontend functions: `80.41%`
  - Delivered:
    - completed roadmap Step `F3`
    - expanded `src/features/navigation/navigationWorkflows.ts` to cover change-tier modal open-state helpers
    - reduced change-tier modal opening branching inside `ConnectionNavigator.tsx`
- After frontend batch-download planning extraction:
  - Frontend line coverage: `28.72%`
  - Frontend statements: `28.72%`
  - Frontend branches: `88.20%`
  - Frontend functions: `80.47%`
  - Delivered:
    - completed roadmap Step `F4`
    - expanded `src/features/navigation/navigationDownloads.ts` to cover batch-download planning
    - reduced batch-download branching inside `ConnectionNavigator.tsx`
- After frontend delete-state transition extraction:
  - Frontend line coverage: `28.87%`
  - Frontend statements: `28.87%`
  - Frontend branches: `88.25%`
  - Frontend functions: `80.61%`
  - Delivered:
    - completed roadmap Step `F5`
    - expanded `src/features/navigation/navigationSecondaryModalState.ts` to cover delete success/error state transitions
    - reduced delete success/error branching inside `ConnectionNavigator.tsx`
- After frontend file-input cleanup completion:
  - Frontend line coverage: `28.95%`
  - Frontend statements: `28.95%`
  - Frontend branches: `88.35%`
  - Frontend functions: `80.74%`
  - Delivered:
    - completed roadmap Step `F6`
    - expanded `src/features/navigation/navigationFileInput.ts` to cover directory-picker default path and multi-file picker normalization
    - reduced remaining picker normalization branching inside `ConnectionNavigator.tsx`
- After frontend content filter/counter glue extraction:
  - Frontend line coverage: `29.11%`
  - Frontend statements: `29.11%`
  - Frontend branches: `88.28%`
  - Frontend functions: `80.93%`
  - Delivered:
    - completed roadmap Step `F7`
    - expanded `src/features/navigation/navigationDerivedState.ts` to cover filter-activity and loaded/displayed count helpers
    - reduced remaining content filter/counter glue inside `ConnectionNavigator.tsx`
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
- After roadmap Step R1:
  - Rust line coverage: `44.83%`
  - Rust regions: `43.66%`
  - Rust functions: `37.59%`
  - `presentation/commands.rs` line coverage: `53.05%`
  - Delivered:
    - completed roadmap Step `R1`
    - extracted terminal-outcome orchestration helpers in `src-tauri/src/presentation/commands.rs` for cache downloads, direct downloads, and uploads
    - expanded command-layer tests to cover success, failure, and cancellation state mapping for AWS and Azure `Window`-driven flows
- After roadmap Step R2:
  - Rust line coverage: `46.83%`
  - Rust regions: `45.84%`
  - Rust functions: `39.36%`
  - `presentation/commands.rs` line coverage: `58.47%`
  - Delivered:
    - completed roadmap Step `R2`
    - extracted 6 progress-dispatch helpers (`dispatch_aws_cache_download_progress`, `dispatch_aws_direct_download_progress`, `dispatch_aws_upload_progress`, `dispatch_azure_cache_download_progress`, `dispatch_azure_direct_download_progress`, `dispatch_azure_upload_progress`) from the 8 upload/download command functions
    - simplified all 8 command progress callbacks to delegate to the dispatch helpers
    - added 2 new test functions covering correct event field mapping and emit error propagation for all 6 helpers
- After provider-content tests (awsProviderContent + azureProviderContent):
  - Frontend line coverage: `~29.5%` (estimate — run `npm run coverage` to confirm exact number)
  - Delivered:
    - created `src/features/aws/awsProviderContent.test.ts` — 14 tests covering all 3 pure functions (`getAwsUploadTierContent`, `getAwsRestoreTierContent`, `getAwsChangeTierContent`), URL constants, option array shape, and translator wiring
    - created `src/features/azure/azureProviderContent.test.ts` — 6 tests covering `getAzureUploadTierContent`, URL constants, option array shape, and translator wiring
    - both files were at 0% coverage before this step

- After quick-win .ts coverage and component render tests (Milestone C closure):
  - Frontend line coverage: `36.39%`
  - Frontend statements: `36.39%`
  - Frontend branches: `90.07%`
  - Frontend functions: `81.58%`
  - Delivered:
    - extended `navigationPresentation.test.ts` — covered `restoring/available/archived` status paths, `getContentStatusLabel(null)`, `formatBytes(TB/NaN/Infinity)`, empty filter paths
    - extended `navigationCacheState.test.ts` — covered Azure provider branch in `resolveCachedFileIdentities`
    - created `connectionSecretsVault.test.ts` — 6 tests covering all vault methods via mocked Tauri layer
    - created `ChangeStorageClassModal.test.tsx` — 9 render tests covering AWS and Azure variants, submitting state, error states, same-class error, choose-destination error
    - created `AwsRestoreRequestPanel.test.tsx` — 6 tests covering tier filtering (GLACIER, DEEP_ARCHIVE, batch), submitting, error, retention input
    - created `RestoreRequestModal.test.tsx` — 5 tests covering AWS/Azure single/batch and generic provider fallback
    - created `AzureRehydrationRequestPanel.test.tsx` — 7 tests covering tier/priority options, submitting, error, cancel, form submit, batch summary
  - **Milestone C reached**: Frontend `36.39%` ✅ (target `35%`), Rust `46.83%` ✅ (target `40%`)

## Step V1 Review Measurement

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `287` passed across `40` files
  - Frontend line coverage: `37.87%`
  - Frontend statements: `37.87%`
  - Frontend branches: `89.56%`
  - Frontend functions: `81.34%`
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `52` passed
  - Rust line coverage: `46.82%`
  - Rust regions: `45.82%`
  - Rust functions: `39.31%`
- Decision: **Milestone C is confirmed complete**.

## Refactoring Plan CN-1d Measurement

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `294` passed across `41` files
  - Frontend line coverage: `38.34%`
  - Frontend statements: `38.34%`
  - Frontend branches: `89.65%`
  - Frontend functions: `81.65%`
- Delivered:
  - completed refactoring roadmap Step `CN-1d`
  - integrated `src/features/navigation/hooks/useContentListingState.ts` into `ConnectionNavigator.tsx`
  - added `src/features/navigation/hooks/useContentListingState.test.ts`

## Refactoring Plan CN-1e Measurement

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `301` passed across `42` files
  - Frontend line coverage: `38.63%`
  - Frontend statements: `38.63%`
  - Frontend branches: `89.66%`
  - Frontend functions: `81.70%`
- Delivered:
  - completed refactoring roadmap Step `CN-1e`
  - integrated `src/features/navigation/hooks/useConnectionFormState.ts` into `ConnectionNavigator.tsx`
  - added `src/features/navigation/hooks/useConnectionFormState.test.ts`

## Refactoring Plan V3 Closure

- CN-1 is complete: `useNavigationPreferencesState`, `useTransferState`, `useModalOrchestrationState`, `useContentListingState`, and `useConnectionFormState`.
- Frontend coverage after CN-1: `38.63%`
- Next refactoring phase: CN-2 component extraction.

## Refactoring Plan CN-2a Measurement

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `307` passed across `43` files
  - Frontend line coverage: `42.77%`
  - Frontend statements: `42.77%`
  - Frontend branches: `88.25%`
  - Frontend functions: `80.11%`
- Delivered:
  - completed refactoring roadmap Step `CN-2a`
  - extracted `src/features/navigation/components/ContentItemList.tsx`
  - added `src/features/navigation/components/ContentItemList.test.tsx`

## Refactoring Plan CN-2b Measurement

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `313` passed across `44` files
  - Frontend line coverage: `44.12%`
  - Frontend statements: `44.12%`
  - Frontend branches: `88.31%`
  - Frontend functions: `80.65%`
- Delivered:
  - completed refactoring roadmap Step `CN-2b`
  - extracted `src/features/navigation/components/ContentExplorerHeader.tsx`
  - added `src/features/navigation/components/ContentExplorerHeader.test.tsx`

## Refactoring Plan CN-2c Measurement

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `319` passed across `45` files
  - Frontend line coverage: `46.36%`
  - Frontend statements: `46.36%`
  - Frontend branches: `87.77%`
  - Frontend functions: `81.05%`
- Delivered:
  - completed refactoring roadmap Step `CN-2c`
  - extracted `src/features/navigation/components/ConnectionsSidebar.tsx`
  - added `src/features/navigation/components/ConnectionsSidebar.test.tsx`

## Refactoring Plan CN-2d Measurement

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `325` passed across `46` files
  - Frontend line coverage: `49.35%`
  - Frontend statements: `49.35%`
  - Frontend branches: `87.86%`
  - Frontend functions: `81.93%`
- Delivered:
  - completed refactoring roadmap Step `CN-2d`
  - extracted `src/features/navigation/components/ConnectionFormModal.tsx`
  - added `src/features/navigation/components/ConnectionFormModal.test.tsx`

## Refactoring Plan CN-2e Measurement

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `331` passed across `47` files
  - Frontend line coverage: `52.90%`
  - Frontend statements: `52.90%`
  - Frontend branches: `87.04%`
  - Frontend functions: `81.63%`
- Delivered:
  - completed refactoring roadmap Step `CN-2e`
  - extracted `src/features/navigation/components/NavigatorModalOrchestrator.tsx`
  - added `src/features/navigation/components/NavigatorModalOrchestrator.test.tsx`
  - moved modal/toast rendering out of `ConnectionNavigator.tsx` while keeping async handlers in the parent component

## Refactoring Plan V4 Closure

- CN-2 is complete:
  - `ContentItemList`
  - `ContentExplorerHeader`
  - `ConnectionsSidebar`
  - `ConnectionFormModal`
  - `NavigatorModalOrchestrator`
- Frontend coverage after CN-2: `52.90%`
- Tests: `331` passed across `47` files
- Decision:
  - frontend crossed the interim `50%` threshold
  - `navigationGuards.ts` split is already complete from RF2 and remains a barrel of re-exports
  - next refactoring step should be `RF4`, splitting `connectionService.ts`

## Refactoring Plan RF4 Measurement

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `331` passed across `47` files
  - Frontend line coverage: `53.08%`
  - Frontend statements: `53.08%`
  - Frontend branches: `87.12%`
  - Frontend functions: `82.03%`
- Delivered:
  - completed support split Step `RF4`
  - kept `src/features/connections/services/connectionService.ts` as the public facade
  - extracted `connectionNormalization.ts`, `connectionValidation.ts`, `awsConnectionService.ts`, and `azureConnectionService.ts`
  - preserved existing `connectionService` imports and helper re-exports

## Refactoring Plan V5 Closure

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `331` passed across `47` files
  - Frontend line coverage: `53.08%`
  - Frontend statements: `53.08%`
  - Frontend branches: `87.12%`
  - Frontend functions: `82.03%`
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `52` passed
  - Rust line coverage: `46.82%`
  - Rust regions: `45.82%`
  - Rust functions: `39.31%`
- Decision:
  - frontend is past the interim `50%` threshold after CN-2 and RF4
  - Rust remains below the `55%` milestone target
  - next work should prioritize Rust provider/command coverage before more frontend expansion

## Rust Secret-Service Coverage Step

- Rust test command: `npm run test:rust`
  - Tests: `60` passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `60` passed
  - Rust line coverage: `47.56%`
  - Rust regions: `46.61%`
  - Rust functions: `40.46%`
- Delivered:
  - added unit coverage for AWS secret account-name construction and keyring error message mapping
  - added unit coverage for Azure secret account-name construction and keyring error message mapping
  - added serde contract coverage for AWS/Azure secret input and output DTOs

## Rust Window-State Coverage Step

- Rust test command: `npm run test:rust`
  - Tests: `64` passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `64` passed
  - Rust line coverage: `47.82%`
  - Rust regions: `46.88%`
  - Rust functions: `41.03%`
- Delivered:
  - extracted pure helpers for parsing, serializing, and resolving the window-state path
  - added coverage for valid/invalid saved window-state JSON
  - added coverage for pretty JSON output and path construction

## Rust App/Provider Helper Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::aws_connection_service::tests::formats_provider_service_errors -- --nocapture`
  - Tests: `3` passed
- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml app:: -- --nocapture`
  - Tests: `7` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `70` passed
  - Rust line coverage: `48.32%`
  - Rust regions: `47.49%`
  - Rust functions: `41.84%`
- Delivered:
  - completed roadmap Step `R3`
  - extracted and covered the frontend boot-timeout reload decision in `src-tauri/src/app/bootstrap.rs`
  - expanded `src-tauri/src/app/window_state.rs` coverage for JSON round trips and integer dimension parsing
  - expanded AWS provider-service coverage for missing, blank, and populated provider error metadata
  - `aws_connection_service.rs` line coverage is now `38.64%`
  - `window_state.rs` line coverage is now `36.49%`

## Rust Provider Mutation Helper Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::aws_connection_service::tests::validates_mutation_inputs_for_restore_tier_change_and_delete -- --nocapture`
  - Tests: `1` passed
- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::azure_connection_service::tests::validates_mutation_inputs_and_access_tier_headers -- --nocapture`
  - Tests: `1` passed
- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::azure_connection_service::tests::builds_upload_and_block_commit_payloads -- --nocapture`
  - Tests: `1` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `71` passed
  - Rust line coverage: `49.52%`
  - Rust regions: `48.74%`
  - Rust functions: `42.44%`
- Delivered:
  - completed roadmap Step `R4`
  - extracted and covered AWS S3 folder marker key validation/building
  - extracted and covered Azure folder blob name validation/building
  - extracted and covered Azure single-upload headers, block commit headers, and block-list XML payload construction
  - `aws_connection_service.rs` line coverage is now `39.63%`
  - `azure_connection_service.rs` line coverage is now `51.95%`

## Rust Provider Mutation Guard Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::aws_connection_service::tests::rejects_provider_mutation_inputs_before_network -- --nocapture`
  - Tests: `1` passed
- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::azure_connection_service::tests::rejects_provider_mutation_inputs_before_network -- --nocapture`
  - Tests: `1` passed
- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::azure_connection_service::tests::builds_upload_and_block_commit_payloads -- --nocapture`
  - Tests: `1` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `73` passed
  - Rust line coverage: `54.20%`
  - Rust regions: `53.18%`
  - Rust functions: `46.04%`
- Delivered:
  - completed roadmap Step `R5`
  - covered AWS public mutation guardrails that reject invalid restore, delete, folder, object-exists, and upload inputs before network calls
  - covered Azure public mutation guardrails that reject invalid delete, tier change, rehydration, and upload inputs before network calls
  - extracted and covered upload mode/block-id helpers for AWS/Azure upload branching
  - `aws_connection_service.rs` line coverage is now `48.63%`
  - `azure_connection_service.rs` line coverage is now `58.40%`

## Rust Command Wrapper Guard Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml presentation::commands::tests::provider_mutation_command_wrappers_surface_local_guard_errors -- --nocapture`
  - Tests: `1` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `74` passed
  - Rust line coverage: `58.99%`
  - Rust regions: `55.88%`
  - Rust functions: `50.06%`
- Delivered:
  - completed roadmap Step `R6`
  - covered AWS/Azure provider mutation command wrappers that surface local guard errors before network calls
  - `presentation/commands.rs` line coverage is now `71.04%`
  - `aws_connection_service.rs` line coverage is now `49.25%`
  - `azure_connection_service.rs` line coverage is now `59.43%`
  - **Milestone D reached**: Frontend `53.08%` ✅ (target `50%`), Rust `58.99%` ✅ (target `55%`)

## Frontend App Shell/i18n Coverage Step

- Targeted frontend test command: `npx vitest run src/app/App.test.tsx src/app/ErrorBoundary.test.tsx src/app/providers.test.tsx src/lib/i18n/I18nProvider.test.tsx src/lib/i18n/useI18n.test.tsx`
  - Tests: `8` passed across `5` files
- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `339` passed across `52` files
  - Frontend line coverage: `53.98%`
  - Frontend statements: `53.98%`
  - Frontend branches: `87.47%`
  - Frontend functions: `83.57%`
- Build command: `npm run build`
  - Result: passed
- Delivered:
  - completed roadmap Step `F8`
  - added coverage for `App`, `AppProviders`, `ErrorBoundary`, `I18nProvider`, and `useI18n`
  - moved `src/app/App.tsx`, `src/app/ErrorBoundary.tsx`, `src/app/providers.tsx`, and `src/lib/i18n/useI18n.ts` to `100%` line coverage
  - moved `src/lib/i18n/I18nProvider.tsx` to `96.36%` line coverage

## Frontend ConnectionNavigator Home Coverage Step

- Targeted frontend test command: `npx vitest run src/features/navigation/ConnectionNavigator.test.tsx --reporter verbose --test-timeout 5000 --hook-timeout 5000`
  - Tests: `2` passed
- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `341` passed across `53` files
  - Frontend line coverage: `62.77%`
  - Frontend statements: `62.77%`
  - Frontend branches: `84.00%`
  - Frontend functions: `67.22%`
- Build command: `npm run build`
  - Result: passed
- Delivered:
  - completed roadmap Step `F9`
  - added first render/guard coverage for `ConnectionNavigator.tsx` home state with mocked Tauri/provider IO
  - covered empty connection loading, home shell controls, create-modal opening, locale dispatch, and connection-load error display
  - moved `ConnectionNavigator.tsx` from `0%` to `29.57%` line coverage

## Next Steps Toward Next Milestone

Ordered by likely value:

1. Add one focused `ConnectionNavigator.tsx` connected-state render/guard step to cross frontend `65%`.
2. Prefer remaining high-risk `ConnectionNavigator` workflows and extracted navigation helpers before low-value component snapshots.
3. Re-run `npm run test:frontend:coverage` and update this tracker after each frontend step.
4. Revisit Rust after frontend reaches the next threshold or if provider/command changes introduce new risk.
