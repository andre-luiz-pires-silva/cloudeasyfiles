# Feature Spec: File Restore

## Objective

Define how CloudEasyFiles exposes restoration of archived files, starting with AWS S3 Glacier and related AWS archival tiers.

## Context

Archived files are not immediately downloadable. The product needs a restore workflow that is transparent about AWS behavior, cost tradeoffs, and temporary availability without inventing a fake cross-provider abstraction.

## Functional Requirements

- Archived AWS files must expose a `Restore` action in the file row or contextual actions.
- Triggering `Restore` must open an AWS-specific restore modal.
- The restore modal must show file name and file size before confirmation.
- The modal must let the user choose one AWS restore tier:
  - `Expedited`
  - `Standard`
  - `Bulk`
- Each tier option must show:
  - estimated restore time
  - approximate cost guidance
  - plain-language explanation of when to use it
- The modal must let the user configure how many days the restored copy remains temporarily available.
- The modal must explain that the file returns to Glacier or the original archival tier after the retention period.
- The modal must explain that retention days affect temporary storage cost, not the restore request fee itself.
- The modal must show visible links to AWS official restore and pricing documentation.
- The modal must show a confirmation summary before the user submits the request.
- The explorer and related UI must reflect provider-reported availability states:
  - `Archived`
  - `Restoring`
  - `Available`
- The app must expose a footer indicator for active restores in addition to active downloads and uploads.
- Activating the restore footer indicator must open a list of files currently restoring.
- The restoring list must show current status and any provider-derived estimate when available.

## Non-Functional Requirements

- Restore UX must remain explicit about AWS-specific behavior rather than hiding it behind generic language.
- Restore-related state shown in the UI must come from the provider, not from local persisted history.
- The product should help users make cost-sensitive decisions without claiming exact pricing.
- Restore monitoring must not require continuous background polling.

## Business Rules

- Restore is not a provider-generic workflow in V1.
- AWS restore is implemented as a provider-specific feature and should live in an AWS-specific implementation area such as `src/features/aws-restore/`.
- Future Azure rehydration support must be documented and implemented separately rather than forced into the AWS model.
- The restore modal content may use repository-maintained static estimates for time and cost.
- Static estimates are advisory only and do not replace AWS official values.
- The cloud provider is the source of truth for current restore state.
- The application must not persist restore history locally.
- The application must not maintain a local restore state that can diverge from provider state.
- Only active restore operations are visible in the product.
- Completed restores disappear from the restore activity list once the provider no longer reports them as in progress.
- Restore activity must be rediscovered when the app reconnects to AWS by inspecting object metadata, because AWS does not expose a single global restore-jobs API for this workflow.
- Refresh of restore state occurs on navigation, explicit refresh, screen open, and connection initialization.
- V1 must not use automatic polling for restore monitoring.
- If the restore list is open and refreshed state shows completion, the item disappears from the list and the main file row updates accordingly.
- V1 must not emit dedicated completion notifications for restore.
- Restore availability duration is temporary and must never be presented as a permanent storage-class change.

## UX Expectations

- Users should understand why file size matters before choosing a restore tier.
- The restore modal should make the cost-versus-speed tradeoff easy to compare.
- The footer should communicate ongoing operational activity without becoming a historical log.
- Restore monitoring should feel current when the user navigates or refreshes, without implying real-time streaming updates.
- Files that are already restoring should not invite duplicate restore requests from the main list.

## Acceptance Criteria

- An AWS archived file shows a `Restore` action.
- Triggering that action opens an AWS-specific restore modal rather than a generic provider-neutral dialog.
- The modal shows file name, file size, restore-tier options, retention days, AWS documentation links, and a confirmation summary.
- Restore-tier options include estimated time, approximate cost guidance, and explanation text.
- The main file list can represent `Archived`, `Restoring`, and `Available` based on provider state.
- The footer shows separate indicators for downloads, uploads, and restores in progress.
- Opening the restore indicator shows only active restore operations.
- Closing and reopening the app does not invent or preserve restore history locally; active restores are rediscovered from AWS state.
- Without explicit refresh, navigation event, screen open, or reconnection, the app does not auto-poll restore status.
- When AWS no longer reports a restore as active, the restore item disappears from the active list.

## Out of Scope

- Generic cross-provider restore or rehydration UX
- Persisted restore history
- Restore-completion notifications
- Background polling independent of user interaction
- Exact live pricing calculation from AWS
