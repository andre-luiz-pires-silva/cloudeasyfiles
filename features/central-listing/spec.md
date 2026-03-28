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
- The main panel must support both list view and compact view for the same visible dataset.
- View mode selection must be persisted globally in the app.
- Listing must use incremental loading with a `Carregar mais` action.
- V1 must not expose numbered pagination.
- The explorer counter must reflect normalized navigable entries for the active context.

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

## UX Expectations

- The main panel should be the obvious place for browsing cloud objects.
- Status such as `Available`, `Archived`, and `Restoring` should be visible in the list.
- Restore progress should be shown directly in the file list.
- The user should be able to switch view mode without losing the current path.
- The current browsing path should be explicit through a breadcrumb that starts at the selected connection.
- A folder created in the app should appear as a normal folder, not as a special technical item.
- The counter should read `X itens carregados` when no local filter is active.
- The counter should read `X itens filtrados de Y carregados` when a local filter is active.
- `Carregar mais` should remain available even when a local filter is active, as long as the provider still has more data.
- The disabled `Carregar mais` state should clearly represent that the available listing for the current context has ended.

## Acceptance Criteria

- Selecting a connection can show the currently loaded containers for that connection in the main panel.
- Selecting a container shows its immediate contents in the main panel.
- Selecting a folder shows the immediate contents for that path.
- A folder with both descendant objects and an explicit trailing-slash sentinel appears only once in the listing.
- A folder may appear in the listing even when no explicit trailing-slash sentinel exists, if descendant objects imply that folder path.
- Archived and restoring states are visible in the list.
- The sidebar is not required for deep object browsing.
- Switching between list and compact view updates the current listing immediately.
- The selected view mode persists across app restarts.
- The breadcrumb allows navigation back to the connection level and intermediate path levels.
- The main content area uses `Carregar mais` instead of numbered pagination.
- `Carregar mais` becomes disabled when no more data exists for the current context.
- Without local filter, the explorer counter uses `X itens carregados`.
- With local filter, the explorer counter uses `X itens filtrados de Y carregados`.
- The loaded count is derived from normalized navigable entries rather than raw provider payload counts.
- Local filter does not invalidate the ability to request more results when more provider data exists.

## Out of Scope

- Separate dashboard for restore monitoring
- Using the sidebar as the primary object explorer
- Classic numbered pagination
- User-configurable page size in the explorer UI
