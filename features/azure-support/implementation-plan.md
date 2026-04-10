# Implementation Plan: Azure Support

## Summary

Implement Azure Blob Storage support across the existing CloudEasyFiles workflow model while preserving the current AWS-first architecture style. The first Azure release will use `Shared Key` authentication with `Microsoft Entra ID` visible in the UI as an upcoming option, require `storageAccountName`, support full container and blob browsing, reuse the current transfer-monitor approach for downloads and uploads, expose Azure-native access tiers for upload and tier changes, and implement Azure Archive rehydration through a provider-specific flow that stays honest about its differences from AWS restore.

## Frontend

- Replace the Azure connection placeholder with a real Azure connection form.
- Add `storageAccountName` as a required Azure connection field.
- Add an Azure authentication-method selector with `Shared Key` enabled and `Microsoft Entra ID (coming soon)` visible but unavailable.
- Add Azure `Shared Key` validation and error handling in the connection modal.
- Extend connection models and persistence to support real Azure metadata and secrets.
- Keep the current save/edit/test flow aligned with the existing AWS connection workflow.
- Add Azure connection test feedback using the simplest success message that fits the implementation.
- Refactor the current AWS-only storage-class selector into a reusable provider-aware component that supports AWS and Azure tier catalogs.
- Reuse that provider-aware selector in Azure connection settings for the default upload tier.
- Preserve provider-native tier labels in Azure UI: `Hot`, `Cool`, `Cold`, and `Archive`.
- Allow `Archive` to be selected as the default Azure upload tier.
- Extend the connection and bucket/container views so Azure connections can load and display blob containers alongside AWS buckets.
- Extend the central listing state and actions so Azure containers behave like first-class navigable contexts.
- Reuse the existing explorer, filter, counter, transfer footer, transfer modal, toast, and manual refresh patterns for Azure.
- Add Azure-specific restore or rehydration entry points in the file actions without flattening them into the AWS modal contract.

## Tauri Bridge and Backend

- Add Azure SDK dependencies and backend wiring for Blob Storage.
- Add Azure secret storage in the OS keyring, mirroring the AWS keyring pattern.
- Add Tauri commands for Azure connection secret save/load/delete.
- Add Azure connection-test commands for `Shared Key` validation against the configured storage account.
- Add Azure container-listing commands scoped to the configured storage account.
- Add Azure blob-listing commands with continuation support and normalized folder derivation over flat blob namespaces.
- Add Azure folder-creation commands using the same explicit trailing-slash sentinel strategy already documented for object storage.
- Add Azure download commands for tracked cache downloads and direct downloads.
- Emit Azure download progress events through the same transfer-monitor model already used for AWS.
- Add Azure upload commands with multipart or chunked behavior as required by the SDK and blob API.
- Emit Azure upload progress events through the shared transfer-monitor model.
- Add Azure delete commands for individual blobs and prefix-style folder deletion.
- Add Azure tier-change commands for blob access-tier updates.
- Add Azure rehydration commands based on Azure blob tier changes from `Archive` to an online destination tier.
- Model Azure rehydration options with provider-native inputs such as destination tier and rehydration priority.
- Keep Azure command payloads parallel to the current AWS Tauri bridge style where practical so frontend orchestration stays familiar.

## Domain and State Model

- Add Azure connection draft and saved-summary models that include `storageAccountName`, authentication method, and default upload tier.
- Keep Azure metadata in local storage and Azure secrets in secure OS storage, matching the existing AWS split.
- Prepare the Azure connection model for a future `Microsoft Entra ID` path without implementing that authentication flow yet.
- Preserve the current normalized provider abstraction: shared concepts for connection, container, file, folder, availability, continuation, and transfer state.
- Preserve provider-specific workflow inputs where parity is not real, especially for restore or rehydration.
- Continue exposing provider-native tier labels instead of forcing an artificial cross-provider tier abstraction.
- Reuse normalized `AvailabilityStatus` states: `Available`, `Archived`, and `Restoring`.
- Reuse normalized `DownloadState` derivation for Azure based on provider availability plus tracked cache presence.
- Extend explorer-entry normalization so Azure folder entries merge prefix-derived folders and explicit trailing-slash sentinels the same way AWS currently does.

## Azure Authentication Direction

- Ship Azure support with `Shared Key` as the only functional authentication mode in the first release.
- Require `storageAccountName` because the app will operate directly against Blob Storage data-plane APIs rather than Azure Resource Manager subscription discovery.
- Do not add `restrictedContainerName` because the intended Azure flow is storage-account scoped and does not need an AWS-style permission workaround.
- Keep the current frontend-to-Tauri credential passing model for now, matching the existing AWS implementation, and revisit hardening later as a separate architecture decision.

## Azure Listing and Navigation

- Treat Azure blob containers as the Azure equivalent of AWS buckets in the navigation tree and connection content view.
- Keep file and folder browsing in the main content area with incremental loading and `Carregar mais`.
- Normalize Azure blob listing responses into immediate folders and files before rendering.
- Keep Azure continuation tokens internal and expose only `has more` style UI state.
- Preserve the documented hybrid folder model for Azure: implicit prefix folders plus explicit trailing-slash sentinel blobs.
- Ensure explorer counters, status summaries, and filters operate on normalized Azure entries rather than raw blob payload counts.

## Azure Upload and Tier Handling

- Support Azure uploads to the currently open container path using the saved default Azure tier for that connection.
- Reuse the current overwrite-preflight and batch conflict-resolution UX direction already used for AWS uploads.
- Allow Azure uploads to target any supported Azure tier, including `Archive`.
- Add Azure provider content for tier descriptions and documentation links in the reusable tier selector.
- Extend the current storage-class or tier-change workflow so Azure files can change between Azure-native tiers through a provider-specific action path.

## Azure Rehydration Direction

- Implement Azure archive recovery as Azure-specific rehydration rather than pretending it matches AWS restore semantics.
- Support Azure rehydration only through in-place tier changes from `Archive` to `Hot`, `Cool`, or `Cold`.
- Expose Azure rehydration priority options such as `Standard` and `High`.
- Do not model Azure rehydration as a temporary restored copy with an expiry date because Azure does not expose the same restore-expiry concept used by AWS.
- Treat Azure blobs with `ArchiveStatus` or equivalent provider metadata that indicates rehydration in progress as normalized `Restoring`.
- Treat Azure blobs that complete rehydration as `Available` in the chosen online tier.
- Avoid the Azure copy-based rehydration workflow in the first release because it changes blob identity and complicates the existing explorer and transfer assumptions.
- Preserve provider-specific modal copy and warnings so the user understands that Azure rehydration permanently changes the blob tier instead of creating a temporary restored window.

## Documentation

- Update product and architecture documentation to state more explicitly that the app is intended to simplify archival backup workflows across AWS and Azure.
- Clarify in documentation that Azure `Archive` is an expected and supported upload target rather than an edge case.
- Document the restore-model difference between AWS temporary restore availability and Azure in-place rehydration to an online tier.
- Update any provider abstraction references that currently imply Azure support is planned but not yet modeled in implementation detail.
- Add Azure-specific notes wherever current documentation still says upload, restore, or tier-change behavior is AWS-only.

## Verification

- `npm run build`
- `cargo check`
- Manual checks for Azure connection create, edit, delete, save, reconnect, and startup connection behavior.
- Manual checks for Azure connection testing with valid and invalid `Shared Key` credentials.
- Manual checks for Azure container listing, container-root navigation, folder navigation, and incremental loading.
- Manual checks for Azure folder normalization with implicit prefixes and explicit trailing-slash sentinel blobs.
- Manual checks for Azure tracked downloads, direct downloads, progress updates, and cancelation.
- Manual checks for Azure uploads from picker and drag-and-drop, including overwrite conflict resolution and post-upload refresh.
- Manual checks for Azure tier changes across `Hot`, `Cool`, `Cold`, and `Archive`.
- Manual checks for Azure archive rehydration request, in-progress state detection, manual refresh rediscovery, and final transition back to `Available`.
- Manual checks for mixed-provider stability so AWS behavior remains unchanged while Azure support is added.

## Execution Phases

### Phase 1: Azure Connection Foundations

- Expand frontend connection models, metadata persistence, and secret-vault APIs for Azure.
- Add Azure keyring services and Tauri commands for save, load, and delete of Azure secrets.
- Replace the Azure placeholder with a real connection form.
- Require `storageAccountName`.
- Add the authentication-method selector with `Shared Key` enabled and `Microsoft Entra ID (coming soon)` disabled.
- Add Azure validation rules and connection create, edit, and delete flows.
- Add Azure `Shared Key` connection testing with the simplest viable success message.
- Preserve current AWS behavior and current save/test interaction model unchanged.

Functional tests after Phase 1:

- Create a new Azure connection with valid `storageAccountName` and `Shared Key`.
- Test the Azure connection and verify the UI shows a successful result.
- Save the Azure connection, close the modal, reopen edit mode, and verify the fields reload correctly.
- Delete the Azure connection and verify it disappears from the tree.
- Try invalid Azure input such as an empty `storageAccountName` or empty key and verify validation blocks save/test.
- Confirm the `Microsoft Entra ID (coming soon)` option is visible but cannot be used.
- Confirm AWS connection create, edit, test, and delete still work exactly as before.

### Phase 2: Provider-Aware Tier Selector

- Refactor the current AWS-only storage-class selector into a reusable provider-aware tier selector.
- Keep AWS options and copy unchanged from the user perspective.
- Add Azure tier catalogs and copy for `Hot`, `Cool`, `Cold`, and `Archive`.
- Reuse the component in Azure connection settings for default upload tier selection.
- Keep `Archive` selectable for Azure by design.

Functional tests after Phase 2:

- Open an existing AWS connection and verify the tier selector still behaves exactly as before.
- Open an Azure connection and verify the Azure tier selector shows `Hot`, `Cool`, `Cold`, and `Archive`.
- Save different Azure default upload tiers and verify the selected value persists after closing and reopening the modal.
- Verify the AWS tier selector content was not visually or behaviorally regressed.

### Phase 3: Azure Containers and Explorer Listing

- Add Azure SDK wiring for container listing and blob listing.
- Load Azure containers for a connected Azure storage account.
- Treat Azure containers as the Azure equivalent of AWS buckets in the navigation tree and connection view.
- Add normalized Azure listing in the main explorer with immediate folders and files.
- Support continuation and `Carregar mais`.
- Normalize hybrid folders from prefix-derived folders plus explicit trailing-slash sentinel blobs.
- Reuse counters, filter, breadcrumb, and manual refresh behaviors.
- Map Azure tier and archive metadata into normalized explorer file state.

Functional tests after Phase 3:

- Connect an Azure connection and verify its containers load in the tree and in the connection content view.
- Open a container and verify the root listing appears in the main content area.
- Navigate into nested folders and back through breadcrumbs.
- Verify `Carregar mais` appends more Azure items without resetting the current listing.
- Verify empty folders and sentinel-only folders render correctly.
- Verify Azure archived blobs appear with the expected archived state in the explorer.
- Confirm AWS browsing, counters, filters, and breadcrumbs still work.

### Phase 4: Azure Downloads

- Add Azure tracked cache download and direct download commands.
- Emit Azure download progress events through the shared transfer monitor.
- Reuse current footer and transfer modal behavior for Azure downloads.
- Integrate Azure downloaded-file detection into the current cache-based local state model.
- Add Azure download cancelation aligned with the existing operation model.

Functional tests after Phase 4:

- Download an available Azure blob using tracked `Download` and verify progress appears in the footer and transfer modal.
- Verify the downloaded Azure file becomes `Downloaded` when the tracked cache contains the current version.
- Use `Download As` on an Azure blob and verify the file is exported to the chosen destination.
- Cancel an in-progress Azure download and verify state and messaging match the existing transfer UX.
- Restart the app and verify tracked Azure cached-file detection still works.
- Confirm AWS download and cancelation behavior still works.

### Phase 5: Azure Uploads

- Add Azure upload backend commands and progress events.
- Reuse the current upload orchestration, drag-and-drop entry points, and transfer monitor.
- Apply the saved Azure default upload tier to new Azure uploads.
- Add Azure object or blob existence checks for overwrite preflight.
- Reuse the existing batch conflict-resolution modal.
- Refresh the current Azure folder automatically after successful uploads into that context.

Functional tests after Phase 5:

- Upload one file into an Azure container root and verify it appears after refresh.
- Upload multiple files into an Azure folder and verify progress appears in the shared transfer UI.
- Drag and drop files into the Azure content area and verify the upload starts.
- Trigger overwrite conflicts and verify the existing batch conflict-resolution modal works for Azure.
- Upload files using each Azure default tier, including `Archive`, and verify the resulting explorer metadata reflects the selected tier.
- Confirm AWS uploads still work, including drag and drop and conflict resolution.

### Phase 6: Azure Folder Creation and Delete

- Add Azure explicit folder creation using trailing-slash sentinel blobs.
- Add Azure delete for selected blobs.
- Add Azure prefix-style folder deletion aligned with the existing mixed file and folder deletion UX.
- Reuse selection, confirmation, toast, and refresh patterns already used in AWS.

Functional tests after Phase 6:

- Create a new folder inside an Azure container root and inside a nested Azure folder.
- Verify newly created folders are navigable and remain visible after refresh.
- Delete one Azure file and verify it disappears from the explorer.
- Delete a folder containing descendants and verify the recursive removal works.
- Delete mixed Azure selections of files and folders and verify the result summary is correct.
- Confirm AWS folder creation and delete flows still work.

### Phase 7: Azure Tier Changes and Archive Rehydration

- Add Azure tier-change commands for online and archive transitions.
- Add Azure-specific rehydration modal and orchestration for in-place moves from `Archive` to `Hot`, `Cool`, or `Cold`.
- Add Azure priority options such as `Standard` and `High`.
- Detect Azure rehydration-in-progress metadata and map it to normalized `Restoring`.
- Remove any assumption that Azure exposes an AWS-like restore-expiry date.
- Refresh Azure state on navigation and manual refresh so rehydration progress is rediscovered from provider metadata.

Functional tests after Phase 7:

- Change an Azure blob from `Hot` to `Cool`, `Cold`, and `Archive` and verify the new tier appears after refresh.
- Start Azure rehydration from `Archive` to `Hot`, `Cool`, and `Cold` and verify the action path is Azure-specific.
- Verify a blob being rehydrated appears as `Restoring`.
- After rehydration completes, verify the blob becomes `Available` and its tier changes to the chosen online tier.
- Verify no AWS-style expiry date is shown for Azure rehydration.
- Confirm AWS restore and AWS storage-class change flows still work.

### Phase 8: Documentation and Regression Pass

- Update project and product documentation to emphasize archival backup workflows across AWS and Azure.
- Document Azure `Archive` as a supported upload destination.
- Document the semantic difference between AWS temporary restore availability and Azure in-place rehydration.
- Run a mixed-provider regression pass across the full app.

Functional tests after Phase 8:

- Read the updated docs and verify Azure support and archival-backup positioning are explicit and consistent.
- Execute a smoke test covering one AWS connection and one Azure connection in the same app session.
- Verify create, connect, browse, upload, download, delete, tier change, and restore or rehydration all work in their respective providers without cross-provider regressions.
