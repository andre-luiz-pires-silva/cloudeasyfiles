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
- [x] Frontend interim `65%` reached — Frontend `66.00%` measured after Step F10
- [x] Rust interim `65%` reached — Rust `65.10%` measured after Step R14
- [x] Frontend final target `75%` reached — Frontend `76.90%` measured after Step V2
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

1. **Frontend final coverage target reached** ✅ — Frontend `76.90%`, Rust `70.17%` measured on 2026-04-23
2. Frontend coverage now scopes to application source under `src`, excluding generated/build artifacts from the V8 denominator
3. Next executable priority: expand Rust coverage toward the remaining `75%` final target

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
- [x] Step F10. Add `ConnectionNavigator.tsx` connected-state render/guard coverage to cross frontend `65%`
- [x] Step F11. Cover `ConnectionNavigator.tsx` connection-error render/guard behavior toward frontend `75%`
- [x] Step F12. Cover `ConnectionNavigator.tsx` bucket content load error behavior toward frontend `75%`
- [x] Step F13. Cover `ConnectionNavigator.tsx` user-triggered mutation guard behavior toward frontend `75%`
- [x] Step V2. Re-measure final-target gap and choose the next highest-yield coverage path

### Near-Term Rust Steps

- [x] Step R1. Expand `presentation/commands.rs` coverage for higher-level `Window`-driven command flows
- [x] Step R2. Expand `presentation/commands.rs` coverage for upload/download command-service handoff flows
- [x] Step R3. Expand Rust app/provider helper coverage for bootstrap reload decisions, window-state JSON contracts, and AWS provider error formatting
- [x] Step R4. Expand remaining Rust provider mutation/error-path coverage toward `55%`
- [x] Step R5. Continue Rust provider mutation/error-path coverage toward `55%`
- [x] Step R6. Cross Rust `55%` with one more provider/command coverage step
- [x] Step R7. Expand Rust app state I/O coverage toward the remaining `75%` final target
- [x] Step R8. Cover AWS secret-store success, rollback, and idempotent delete paths
- [x] Step R9. Cover Azure secret-store success, idempotent delete, and error paths
- [x] Step R10. Cover AWS/Azure cache path validation guard branches
- [x] Step R11. Extract and cover AWS S3 list-object response mapping
- [x] Step R12. Extract and cover Azure container listing XML mapping
- [x] Step R13. Extract and cover AWS S3 list-bucket response mapping
- [x] Step R14. Cover read command-wrapper local guard paths before network
- [x] Step R15. Cover mutation command-wrapper restriction/account guard paths before network
- [x] Step R16. Cover AWS/Azure provider download guards before network
- [x] Step R17. Cover AWS/Azure provider upload-path guards before network
- [x] Step R18. Cover AWS/Azure provider upload-bytes guards before network
- [x] Step R19. Cover remaining pure provider mapping/parser guard branches
- [x] Step R20. Cover provider auth/url helpers and local existence guards
- [x] Step R21. Cover remaining provider mutation validation branches before network
- [x] Step R22. Expand bootstrap and window-state local helper coverage
- [x] Step R23. Extract and cover provider upload-cancellation helpers
- [ ] Step R24. Continue Rust provider/command coverage toward the remaining `75%` final target

### Review Step

- [x] Step V1. Re-measure milestone status after F1-F7 and R1-R2, then decide whether Milestone C is reached

## Estimated Remaining Work

- Milestone D (`50%` frontend, `55%` Rust) is complete.
- Frontend final target `75%` is complete.
- Rust has crossed the interim `65%` checkpoint and remains at `70.17%`; next estimate should continue prioritizing the highest-yield Rust provider and command modules.

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

## Frontend ConnectionNavigator Connected-State Coverage Step

- Targeted frontend test command: `npx vitest run src/features/navigation/ConnectionNavigator.test.tsx --reporter verbose --test-timeout 5000 --hook-timeout 5000`
  - Tests: `3` passed
- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `342` passed across `53` files
  - Frontend line coverage: `66.00%`
  - Frontend statements: `66.00%`
  - Frontend branches: `85.57%`
  - Frontend functions: `68.90%`
- Build command: `npm run build`
  - Result: passed
- Delivered:
  - completed roadmap Step `F10`
  - added connected-state render/guard coverage for a saved AWS connection in `ConnectionNavigator.tsx`
  - covered connection test dispatch, container listing, connected indicator rendering, AWS bucket-region hydration, bucket selection, and empty bucket content loading
  - moved `ConnectionNavigator.tsx` to `40.19%` line coverage
  - crossed the frontend interim `65%` target

## Frontend ConnectionNavigator Connection-Error Coverage Step

- Targeted frontend test command: `npx vitest run src/features/navigation/ConnectionNavigator.test.tsx --reporter verbose --test-timeout 5000 --hook-timeout 5000`
  - Tests: `4` passed
- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `343` passed across `53` files
  - Frontend line coverage: `66.66%`
  - Frontend statements: `66.66%`
  - Frontend branches: `86.14%`
  - Frontend functions: `68.90%`
- Build command: `npm run build`
  - Result: passed
- Delivered:
  - completed roadmap Step `F11`
  - added connection-error render/guard coverage for a saved AWS connection in `ConnectionNavigator.tsx`
  - covered failed connection test display, reconnect affordance, error indicators, and guardrails that prevent container listing, draft loading, and bucket-region hydration after connection failure
  - moved `ConnectionNavigator.tsx` to `41.35%` line coverage

## Frontend ConnectionNavigator Bucket-Content Error Coverage Step

- Targeted frontend test command: `npx vitest run src/features/navigation/ConnectionNavigator.test.tsx --reporter verbose --test-timeout 5000 --hook-timeout 5000`
  - Tests: `5` passed
- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `344` passed across `53` files
  - Frontend line coverage: `66.77%`
  - Frontend statements: `66.77%`
  - Frontend branches: `86.19%`
  - Frontend functions: `68.90%`
- Build command: `npm run build`
  - Result: passed
- Delivered:
  - completed roadmap Step `F12`
  - added bucket content load error coverage after a saved AWS connection succeeds
  - covered content-list failure display while preserving the connected indicator and verifying the bucket item-loading request shape
  - stabilized the connection-error render assertion by selecting the failed connection after the error indicator is visible
  - moved `ConnectionNavigator.tsx` to `41.72%` line coverage

## Frontend ConnectionNavigator Create-Folder Guard Coverage Step

- Targeted frontend test command: `npx vitest run src/features/navigation/ConnectionNavigator.test.tsx --reporter verbose --test-timeout 5000 --hook-timeout 5000`
  - Tests: `6` passed
- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `345` passed across `53` files
  - Frontend line coverage: `66.92%`
  - Frontend statements: `66.92%`
  - Frontend branches: `85.96%`
  - Frontend functions: `69.45%`
- Build command: `npm run build`
  - Result: passed
- Delivered:
  - completed roadmap Step `F13`
  - added create-folder validation guard coverage after selecting a connected AWS bucket
  - verified invalid folder names block the mutating `createAwsFolder` provider call
  - moved `ConnectionNavigator.tsx` to `42.46%` line coverage

## Final-Target Gap Review Step V2

- Frontend coverage command: `npm run test:frontend:coverage`
  - Tests: `345` passed across `53` files
  - Frontend line coverage: `76.90%`
  - Frontend statements: `76.90%`
  - Frontend branches: `87.78%`
  - Frontend functions: `74.00%`
- Build command: `npm run build`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `74` passed
  - Rust line coverage: `58.99%`
  - Rust regions: `55.88%`
  - Rust functions: `50.06%`
- Delivered:
  - completed roadmap Step `V2`
  - corrected Vitest coverage scope to measure application frontend source under `src`
  - excluded tests, test setup, generated Tauri assets, and docs page scripts from the frontend coverage denominator
  - confirmed the frontend final `75%` line-coverage target is reached
  - selected Rust as the remaining focus for closing the overall final target

## Rust App State I/O Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml app::window_state::tests -- --nocapture`
  - Tests: `9` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `77` passed
  - Rust line coverage: `59.39%`
  - Rust regions: `56.43%`
  - Rust functions: `50.45%`
- Delivered:
  - completed roadmap Step `R7`
  - extracted path-based `window_state` load/save helpers so filesystem behavior can be covered without a Tauri runtime
  - covered state-file creation, persisted JSON reload, missing-file handling, and invalid-file parse handling
  - kept the public window-state integration behavior unchanged

## Rust AWS Secret Store Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::aws_connection_secret_service::tests -- --nocapture`
  - Tests: `6` passed
- Rust format command: `cargo fmt --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `81` passed
  - Rust line coverage: `60.53%`
  - Rust regions: `57.64%`
  - Rust functions: `51.45%`
- Delivered:
  - completed roadmap Step `R8`
  - introduced an internal AWS secret-store adapter so keyring-backed behavior can be exercised with a fake store in unit tests
  - covered AWS secret save/load success, secret-key save rollback, idempotent missing-entry delete, and load error propagation
  - kept the public `AwsConnectionSecretService` API backed by the real `keyring` adapter

## Rust Azure Secret Store Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::azure_connection_secret_service::tests -- --nocapture`
  - Tests: `5` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `84` passed
  - Rust line coverage: `61.01%`
  - Rust regions: `58.24%`
  - Rust functions: `52.35%`
- Delivered:
  - completed roadmap Step `R9`
  - introduced an internal Azure secret-store adapter mirroring the AWS keyring test seam
  - covered Azure account-key save/load success, idempotent missing-entry delete, and save/load error propagation
  - kept the public `AzureConnectionSecretService` API backed by the real `keyring` adapter

## Rust Provider Cache Guard Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml normalizes_cache_paths_and_rejects_empty -- --nocapture`
  - Tests: `2` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `84` passed
  - Rust line coverage: `61.48%`
  - Rust regions: `58.68%`
  - Rust functions: `52.35%`
- Delivered:
  - completed roadmap Step `R10`
  - covered empty connection-name guards in AWS and Azure cache-root/temp-path helpers
  - covered empty object-key/blob-name guards in primary, legacy raw, legacy encoded, recent legacy, and candidate cache path helpers
  - kept the cache path behavior unchanged while reducing uncovered filesystem guard branches

## Rust AWS Listing Mapping Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::aws_connection_service::tests::builds_bucket_items_result_from_s3_listing_response -- --nocapture`
  - Tests: `1` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `85` passed
  - Rust line coverage: `62.17%`
  - Rust regions: `59.66%`
  - Rust functions: `52.71%`
- Delivered:
  - completed roadmap Step `R11`
  - extracted S3 `ListObjectsV2Output` mapping into a pure helper
  - covered directory deduplication, file deduplication, folder placeholder filtering, storage-class mapping, eTag mapping, and pagination metadata
  - kept the network command path unchanged while making the response transformation testable without AWS calls

## Rust Azure Container Listing Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::azure_connection_service::tests::parses_container_listing_response_with_marker_and_empty_results -- --nocapture`
  - Tests: `1` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `86` passed
  - Rust line coverage: `62.49%`
  - Rust regions: `59.96%`
  - Rust functions: `53.19%`
- Delivered:
  - completed roadmap Step `R12`
  - extracted Azure container-listing XML mapping into a pure helper
  - covered container names, continuation marker mapping, and empty container/marker results
  - kept the signed Azure request path unchanged while making response parsing testable without Azure calls

## Rust AWS Bucket Listing Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::aws_connection_service::tests::builds_bucket_summaries_from_s3_list_buckets_response -- --nocapture`
  - Tests: `1` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `87` passed
  - Rust line coverage: `62.63%`
  - Rust regions: `60.16%`
  - Rust functions: `53.31%`
- Delivered:
  - completed roadmap Step `R13`
  - extracted S3 `ListBucketsOutput` mapping into a pure helper
  - covered bucket-name mapping and ignored unnamed SDK bucket entries
  - kept the network bucket-list command path unchanged while making response transformation testable without AWS calls

## Rust Read Command Guard Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml presentation::commands::tests::read_command_wrappers_surface_local_guard_errors_before_network -- --nocapture`
  - Tests: `1` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `88` passed
  - Rust line coverage: `65.10%`
  - Rust regions: `61.70%`
  - Rust functions: `56.23%`
- Delivered:
  - completed roadmap Step `R14`
  - covered AWS read command wrappers for restricted-bucket mismatch before network
  - covered Azure read command wrappers for blank storage-account and blank container guards before network
  - crossed the Rust interim `65%` checkpoint while keeping CI coverage monitor-only

## Rust Mutation Command Guard Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml presentation::commands::tests::mutation_command_wrappers_surface_restriction_and_account_guards_before_network -- --nocapture`
  - Tests: `1` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `89` passed
  - Rust line coverage: `66.15%`
  - Rust regions: `62.71%`
  - Rust functions: `56.34%`
- Delivered:
  - completed roadmap Step `R15`
  - covered AWS mutation command wrappers for restricted-bucket mismatch with otherwise valid inputs
  - covered Azure mutation command wrappers for blank storage-account guards before network
  - pushed Rust coverage further past the interim `65%` checkpoint while keeping CI coverage monitor-only

## Rust Provider Download Guard Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml rejects_provider_download_inputs_before_network -- --nocapture`
  - Tests: `2` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `91` passed
  - Rust line coverage: `67.67%`
  - Rust regions: `64.11%`
  - Rust functions: `57.11%`
- Delivered:
  - completed roadmap Step `R16`
  - covered AWS tracked/direct download local guard failures before network
  - covered AWS restricted-bucket mismatch in provider download flow before network
  - covered Azure tracked/direct download local guard failures before network

## Rust Provider Upload Path Guard Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml rejects_provider_upload_path_inputs_before_network -- --nocapture`
  - Tests: `2` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `93` passed
  - Rust line coverage: `68.29%`
  - Rust regions: `64.95%`
  - Rust functions: `56.97%`
- Delivered:
  - completed roadmap Step `R17`
  - covered AWS upload-from-path local directory rejection and restricted-bucket mismatch after local metadata validation
  - covered Azure upload-from-path local directory rejection, blank storage account after metadata validation, and blank container guard
  - used temporary local files/directories to exercise filesystem validation without reaching provider calls

## Rust Provider Upload Bytes Guard Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml rejects_provider_upload_bytes_inputs_before_network -- --nocapture`
  - Tests: `2` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `95` passed
  - Rust line coverage: `68.70%`
  - Rust regions: `65.28%`
  - Rust functions: `56.91%`
- Delivered:
  - completed roadmap Step `R18`
  - covered AWS upload-bytes invalid storage-class and restricted-bucket guards before network
  - covered Azure upload-bytes blank storage-account and unsupported access-tier guards before network

## Rust Provider Mapping/Parser Guard Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::aws_connection_service::tests -- --nocapture`
  - Tests: `27` passed
- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::azure_connection_service::tests -- --nocapture`
  - Tests: `22` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `96` passed
  - Rust line coverage: `68.87%`
  - Rust regions: `65.52%`
  - Rust functions: `57.36%`
- Delivered:
  - completed roadmap Step `R19`
  - covered AWS bucket-region resolution when a region is already supplied and when a restriction blocks before network
  - covered additional S3 listing mapper branches for missing object keys and default storage class
  - covered invalid XML errors for Azure container and blob listing parsers

## Rust Provider Auth/URL Helper Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::aws_connection_service::tests -- --nocapture`
  - Tests: `27` passed
- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::azure_connection_service::tests -- --nocapture`
  - Tests: `23` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `97` passed
  - Rust line coverage: `69.48%`
  - Rust regions: `66.18%`
  - Rust functions: `57.65%`
- Delivered:
  - completed roadmap Step `R20`
  - covered AWS `object_exists` restricted-bucket guard with a provided region before network
  - covered Azure shared-key authorization, account/blob URL normalization, and canonicalized-resource edge handling
  - covered Azure `blob_exists` blank-container local guard before any provider request

## Rust Provider Mutation Validation Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::aws_connection_service::tests -- --nocapture`
  - Tests: `27` passed
- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::azure_connection_service::tests -- --nocapture`
  - Tests: `23` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `97` passed
  - Rust line coverage: `69.71%`
  - Rust regions: `66.50%`
  - Rust functions: `57.76%`
- Delivered:
  - completed roadmap Step `R21`
  - covered AWS restore validation for Deep Archive expedited requests, unsupported restore tiers, and invalid target storage classes
  - covered Azure folder creation blank-container guard plus access-tier and rehydration validation branches
  - kept the new coverage on service-level validation paths that fail before any provider request

## Rust Bootstrap/Window-State Helper Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml app::bootstrap::tests -- --nocapture`
  - Tests: `2` passed
- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml app::window_state::tests -- --nocapture`
  - Tests: `11` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `100` passed
  - Rust line coverage: `69.96%`
  - Rust regions: `66.77%`
  - Rust functions: `58.01%`
- Delivered:
  - completed roadmap Step `R22`
  - extracted bootstrap timeout and missing-window log-message helpers and covered them directly
  - covered window-state save failures when parent creation fails or the destination path is already a directory
  - improved low-coverage app-support modules without introducing UI-runtime test scaffolding

## Rust Upload-Cancellation Helper Coverage Step

- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::aws_connection_service::tests -- --nocapture`
  - Tests: `28` passed
- Targeted Rust test command: `cargo test --manifest-path src-tauri/Cargo.toml application::services::azure_connection_service::tests -- --nocapture`
  - Tests: `24` passed
- Rust check command: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Rust coverage command: `npm run test:rust:coverage`
  - Tests: `102` passed
  - Rust line coverage: `70.17%`
  - Rust regions: `66.93%`
  - Rust functions: `58.21%`
- Delivered:
  - completed roadmap Step `R23`
  - extracted repeated AWS/Azure upload-cancellation checks into local helpers
  - covered active-vs-cancelled atomic-flag behavior directly in both provider modules
  - reduced duplication in multipart/block upload code while preserving cancellation semantics

## Next Steps Toward Final Target

Ordered by likely value:

1. Continue Rust coverage toward `75%`, starting with the highest-yield provider or command modules.
2. Prefer provider command wrappers and service helpers that protect file operations before lower-value branches.
3. Re-run `npm run test:rust:coverage` and update this tracker after each Rust step.
