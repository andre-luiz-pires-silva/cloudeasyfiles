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
- When AWS reports a temporary restored copy for an archival object, the explorer must preserve the archival context while also showing that the file is currently available.
- When the user is browsing a bucket or folder, the loaded-context summary must include how many loaded files are currently `Restoring`.
- The restore summary must be derived only from the currently loaded context, not from a global account-wide scan.
- The restore detail must appear as part of the loaded-count summary, for example `37 itens carregados (30 disponíveis, 7 restaurando)`.

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
- The product must not perform a connection-wide restore scan just to populate a global restore counter.
- Restore state is discovered from the same provider listing data already loaded for the current context.
- Refresh of restore state occurs when the current context is loaded or refreshed.
- V1 must not use automatic polling for restore monitoring.
- V1 must not emit dedicated completion notifications for restore.
- Restore availability duration is temporary and must never be presented as a permanent storage-class change.
- Provider metadata such as AWS restore expiry is the source of truth for how long the temporary restored copy remains available.

## UX Expectations

- Users should understand why file size matters before choosing a restore tier.
- The restore modal should make the cost-versus-speed tradeoff easy to compare.
- Restore detail in the list summary should feel local to what the user is currently seeing.
- Restore monitoring should feel current when the user navigates or refreshes the current context, without implying real-time streaming updates.
- Files that are already restoring should not invite duplicate restore requests from the main list.
- Files that are temporarily restored should communicate both immediate usability and continued archival origin.

## Acceptance Criteria

- An AWS archived file shows a `Restore` action.
- Triggering that action opens an AWS-specific restore modal rather than a generic provider-neutral dialog.
- The modal shows file name, file size, restore-tier options, retention days, AWS documentation links, and a confirmation summary.
- Restore-tier options include estimated time, approximate cost guidance, and explanation text.
- The main file list can represent `Archived`, `Restoring`, and `Available` based on provider state.
- A temporarily restored archival file can simultaneously communicate `Available` and `Archived` before it has been downloaded.
- When the provider reports a restore-expiry timestamp, the UI can expose that deadline as contextual detail for the `Available` signal.
- The loaded-context summary shows restore detail only for the currently loaded bucket or folder contents.
- Without explicit refresh or context navigation, the app does not auto-poll restore status.
- When AWS no longer reports a file as restoring in the loaded context, the summary and file row update on the next context load or refresh.

## Out of Scope

- Generic cross-provider restore or rehydration UX
- Persisted restore history
- Restore-completion notifications
- Background polling independent of user interaction
- Global account-wide restore dashboard
- Exact live pricing calculation from AWS
