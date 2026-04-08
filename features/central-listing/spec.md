# Feature Spec: Central Listing

## Objective

Define the main content area as the primary place for browsing cloud objects.

## Context

The sidebar is intentionally simplified, so the main panel must handle object exploration for the currently selected context.

## Functional Requirements

- When a connection is selected, the main panel may show the currently loaded containers for that connection below the connection details.
- When a container is selected, the main panel lists immediate folders and immediate files.
- When a folder is selected, the main panel lists immediate folders and immediate files for that path.
- Navigation must proceed level by level.
- File availability and relevant status information should be visible in the list.
- File download state should be visible in the list.
- The main panel must support local status filters for the loaded normalized explorer dataset.
- The main panel must support both list view and compact view for the same visible dataset.
- View mode selection must be persisted globally in the app.
- Listing must use incremental loading with a `Carregar mais` action.
- V1 must not expose numbered pagination.
- The explorer counter must reflect normalized navigable entries for the active context.
- The main panel must expose a manual refresh action for the active context.
- The main panel must expose folder creation for supported bucket contexts.
- The main panel must surface contextual file actions for tracked download, `Download As`, canceling active downloads, and local-cache inspection where available.
- The main panel must surface a direct open action for tracked cached files where available.
- The main panel must support persistent checkbox selection for visible files and folders in bucket contexts.
- The main panel must support delete actions for files and folders in supported provider contexts.

## Non-Functional Requirements

- The main panel should handle larger object sets more gracefully than the tree.
- Listing behavior should remain cloud-first.
- The UI should expose only listing information that is reliable for the currently loaded context.

## Business Rules

- Listing is always resolved from the cloud provider.
- Local cache only enriches file state and never becomes the listing source.
- Provider-native listing payloads must be normalized into navigable explorer entries before rendering.
- The UI must present folder entries simply as folders.
- Folder entries may come from prefix inference, explicit trailing-slash sentinels, or both.
- The visible listing must deduplicate equivalent folder representations.
- `Carregar mais` is the primary continuation action for the current context.
- `Carregar mais` becomes disabled when the current context has no more data to load.
- The UI must not expose provider cursor/token details directly to the user.
- The UI must not expose page size as a user-controlled option in V1.
- The displayed loaded count must use normalized navigable entries rather than raw provider response counts.
- The UI must not assume an exact global total of items exists for the current directory or container.
- Local status filters must refine only the already loaded normalized explorer dataset and must not trigger provider reloads by themselves.
- For the status-button filter, both no selection and full selection must behave as no filter.
- Loaded-context status summaries must be derived from the currently loaded normalized explorer dataset for the active bucket or folder.
- Automatic refresh must not run continuously for ordinary browsing.
- Manual refresh remains available even when no background monitoring is active.
- Folder creation in supported object-storage contexts must write an explicit folder marker and rely on the refreshed provider listing as the source of truth.
- Folder delete in supported object-storage contexts may be recursive and must follow provider-backed prefix/object semantics rather than pretending folders are local filesystem directories.

## UX Expectations

- The main panel should be the obvious place for browsing cloud objects.
- Status such as `Available`, `Archived`, and `Restoring` should be visible in the list.
- Download state such as `Not downloaded`, `Restoring`, `Available to download`, and `Downloaded` should be understandable from the list without opening a separate screen.
- Active tracked download progress should be shown directly in the file list.
- If a file already has an active download, its context menu should expose cancelation instead of inviting duplicate starts.
- The user should be able to switch view mode without losing the current path.
- The current browsing path should be explicit through a breadcrumb that starts at the selected connection.
- A folder created in the app should appear as a normal folder, not as a special technical item.
- The counter should read `X itens carregados` when no local filter is active.
- The counter should read `X itens filtrados de Y carregados` when a local filter is active.
- Status buttons should start unselected in the explorer toolbar.
- No selected status buttons should behave as no status filter.
- A partial status selection should filter the loaded normalized explorer dataset by the selected statuses.
- A full status selection should behave as no status filter.
- When summary statuses are known for the loaded context, the counter area should also show a compact status breakdown for the current loaded dataset.
- `Carregar mais` should remain available even when a local filter is active, as long as the provider still has more data.
- The disabled `Carregar mais` state should clearly represent that the available listing for the current context has ended.
- A visible refresh action should make it clear that the user can update the current listing on demand.
- In supported bucket contexts, the toolbar should expose `Nova pasta` near the other context actions.
- The empty-area context menu in the main panel should expose `Nova pasta` and `Atualizar` for supported bucket contexts.
- Downloaded tracked-cache files should expose both `Abrir` and `Abrir no Explorador de Arquivos local`.
- Bucket listings should show always-visible checkboxes for files and folders so multi-selection remains discoverable.
- When one or more items are selected, the main panel should expose clear batch actions for `Limpar seleção` and `Remover`.
- Delete confirmation for folders or mixed selections should explicitly warn that folder removal is recursive.

## Acceptance Criteria

- Selecting a connection can show the currently loaded containers for that connection in the main panel.
- Selecting a container shows its immediate contents in the main panel.
- Selecting a folder shows the immediate contents for that path.
- A folder with both descendant objects and an explicit trailing-slash sentinel appears only once in the listing.
- A folder may appear in the listing even when no explicit trailing-slash sentinel exists, if descendant objects imply that folder path.
- Archived and restoring states are visible in the list.
- Download state is visible in the list.
- Cached files can expose a contextual action to open their local parent folder when a local cache is configured.
- Active downloads can expose a contextual cancel action from the same file row.
- The sidebar is not required for deep object browsing.
- Switching between list and compact view updates the current listing immediately.
- The selected view mode persists across app restarts.
- The breadcrumb allows navigation back to the connection level and intermediate path levels.
- The main content area uses `Carregar mais` instead of numbered pagination.
- `Carregar mais` becomes disabled when no more data exists for the current context.
- Without local filter, the explorer counter uses `X itens carregados`.
- With local filter, the explorer counter uses `X itens filtrados de Y carregados`.
- Status buttons start unselected when entering a bucket context.
- With no selected status buttons, the explorer behaves as unfiltered by status.
- With a partial status selection, only matching loaded normalized explorer entries remain visible.
- With all status buttons selected, the explorer behaves as unfiltered by status.
- The current loaded context can expose a local status breakdown for summary states such as `Folders`, `Downloaded`, `Available`, `Restoring`, and `Archived`.
- The loaded count is derived from normalized navigable entries rather than raw provider payload counts.
- Local filter does not invalidate the ability to request more results when more provider data exists.
- Local status filters do not invalidate the ability to request more results when more provider data exists.
- The active context can be refreshed manually without requiring navigation away and back.
- In supported bucket contexts, `Nova pasta` creates a folder in the current logical path and the new folder appears after the post-create refresh.
- In supported bucket contexts, right-clicking the empty area of the listing opens a custom context menu with `Nova pasta` and `Atualizar`.
- Downloaded tracked-cache files can be opened with the OS default app from the file context menu.
- The listing does not poll automatically for restore completion; state updates arrive through navigation, screen open, reconnection, or explicit refresh.
- In supported bucket contexts, files and folders can be selected through persistent row checkboxes.
- In supported bucket contexts, the explorer can remove a mixed selection of files and folders after explicit confirmation.
- In supported bucket contexts, deleting a folder removes provider content recursively for that logical folder path and refreshes the listing afterward.

## Out of Scope

- Using the sidebar as the primary object explorer
- Classic numbered pagination
- User-configurable page size in the explorer UI
