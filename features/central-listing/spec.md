# Feature Spec: Central Listing

## Objective

Define the main content area as the primary place for browsing cloud objects.

## Context

The sidebar is intentionally simplified, so the main panel must handle object exploration for the currently selected context.

## Functional Requirements

- When a connection is selected, the main panel may show the currently loaded containers for that connection below the connection details.
- When a container is selected, the main panel lists immediate virtual subdirectories and immediate files.
- When a virtual directory is selected, the main panel lists immediate virtual subdirectories and immediate files for that path.
- Navigation must proceed level by level.
- File availability and relevant status information should be visible in the list.
- The main panel must support both list view and compact view for the same visible dataset.
- View mode selection must be persisted globally in the app.

## Non-Functional Requirements

- The main panel should handle larger object sets more gracefully than the tree.
- Listing behavior should remain cloud-first.

## Business Rules

- Listing is always resolved from the cloud provider.
- Local cache only enriches file state and never becomes the listing source.
- Virtual directories are resolved dynamically from prefixes.

## UX Expectations

- The main panel should be the obvious place for browsing cloud objects.
- Status such as `Available`, `Archived`, and `Restoring` should be visible in the list.
- Restore progress should be shown directly in the file list.
- The user should be able to switch view mode without losing the current path.
- The current browsing path should be explicit through a breadcrumb that starts at the selected connection.

## Acceptance Criteria

- Selecting a connection can show the currently loaded containers for that connection in the main panel.
- Selecting a container shows its immediate contents in the main panel.
- Selecting a virtual directory shows the immediate contents for that path.
- Archived and restoring states are visible in the list.
- The sidebar is not required for deep object browsing.
- Switching between list and compact view updates the current listing immediately.
- The selected view mode persists across app restarts.
- The breadcrumb allows navigation back to the connection level and intermediate path levels.

## Out of Scope

- Separate dashboard for restore monitoring
- Using the sidebar as the primary object explorer
