# Feature Spec: Download Management

## Objective

Define the current tracked-download behavior and the current direct-download direction.

## Context

CloudEasyFiles distinguishes between cloud browsing and file acquisition. The current implementation provides an AWS tracked download workflow for cached files, a separate AWS direct export flow for `Download As`, and a lightweight transfer-monitoring experience that does not introduce permanent background polling.

## Functional Requirements

- Files must expose a user-facing tracked download state.
- The supported tracked download states are `NotDownloaded`, `Restoring`, `AvailableToDownload`, and `Downloaded`.
- In the current AWS implementation, `Download` must place the file in the configured global local cache.
- `Download` must be progress-monitored by the application.
- `Download As` must remain a separate direct-export action from tracked `Download`.
- Active `Download As` operations must also participate in transfer monitoring while in progress.
- The bottom bar must expose transfer summary controls, with active downloads becoming actionable when present.
- Activating the download summary while downloads are active must open a modal with active transfer details.
- The modal must show active download progress.
- V1 must offer cancelation for active `Download` and `Download As` operations.
- V1 must not offer pause or resume controls for downloads.
- The product must support restore-dependent downloads for archived content.
- The main explorer must continue to show file-level restore and download state while browsing.
- The current tracked-download implementation is AWS-only.

## Non-Functional Requirements

- Download monitoring should be visible without forcing users into a separate full-screen workflow.
- The state model should remain understandable across AWS and Azure.
- The app should not imply capabilities such as resumable pause or provider-independent concurrency that are not actually guaranteed.

## Business Rules

- `Download` and `Download As` are different workflows and must not be merged into a single ambiguous action.
- `Download` is a tracked cache workflow.
- `Download As` is the untracked export workflow after the export operation completes.
- `Download As` is still an active monitored transfer while it is running.
- Cancelation is supported only while a transfer is active.
- Pause and resume remain out of scope in the current V1 implementation.
- Tracked downloads are allowed only when the file is currently available from the provider.
- If an archived file is restoring, its tracked download state is `Restoring` until the provider reports it as available.
- `AvailableToDownload` means the file is provider-available and does not already have a current tracked cached copy.
- `Downloaded` means the tracked cache has the current file version.
- `NotDownloaded` means the file does not currently have a tracked cached copy and is not in an active restore workflow.
- The current implementation resolves tracked cache presence by checking whether the expected cached file exists locally.
- The current tracked cache root is configured globally in the app and uses a stable per-connection folder derived from `connection_id`.
- The application must not claim a single global concurrent-download number across providers.
- Outside active restore workflows, the application must not poll automatically for updated listing state.
- Manual refresh remains the standard way to update cloud state when no monitored workflow is active.

## UX Expectations

- A user looking at the explorer should be able to understand whether a file still needs restore, is ready for tracked download, or is already cached.
- The bottom bar should act as a lightweight operational summary rather than as a second explorer.
- The modal should focus on active download details and progress.
- Users should expect cancelation for active downloads, but not paused or resumed downloads.
- Manual refresh should stay discoverable so users understand that normal browsing is not continuously auto-updating.

## Acceptance Criteria

- A file can be represented with exactly one of the four documented tracked download states at a time.
- `Download` stores into local cache and is tracked by the app.
- `Download As` remains documented as a separate flow and is not represented as tracked local-cache state after completion.
- Active `Download` and `Download As` operations produce a bottom-bar summary affordance.
- Opening the summary affordance reveals a modal with active download details and progress.
- The file context menu and transfer modal both expose cancel controls for active downloads.
- The documented refresh model uses manual refresh by default and polling only while restore workflows are active.

## Out of Scope

- Pause and resume for downloads
- Persistent queued-download UX beyond the provider-limited active set
- Tracking `Download As` history after export completion
- Permanent background polling during normal browsing
