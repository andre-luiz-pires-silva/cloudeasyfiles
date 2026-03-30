# Feature Spec: Download Management

## Objective

Define how tracked downloads, direct downloads, restore-dependent downloads, and download monitoring behave across providers.

## Context

CloudEasyFiles distinguishes between cloud browsing and file acquisition. The product needs a clear tracked download workflow for cached files, a separate direct export flow, and a lightweight monitoring experience that does not introduce permanent background polling.

## Functional Requirements

- Files must expose a user-facing tracked download state.
- The supported tracked download states are `NotDownloaded`, `Restoring`, `AvailableToDownload`, and `Downloaded`.
- `Download` must place the file in the configured local cache.
- `Download` must be progress-monitored by the application.
- `Download As` must export the file to a user-selected destination without post-export tracking.
- The bottom bar must include a download summary icon whenever tracked downloads are active.
- Activating the bottom-bar summary icon must open a modal with tracked download details.
- The modal must show active download progress and allow canceling tracked downloads.
- V1 must not offer pause or resume controls for tracked downloads.
- The product must support restore-dependent downloads for archived content.
- The main explorer must continue to show file-level restore and download state while browsing.
- The active provider adapter must define how many tracked downloads can run simultaneously.

## Non-Functional Requirements

- Download monitoring should be visible without forcing users into a separate full-screen workflow.
- The state model should remain understandable across AWS and Azure.
- The app should not imply capabilities such as resumable pause or provider-independent concurrency that are not actually guaranteed.

## Business Rules

- `Download` and `Download As` are different workflows and must not be merged into a single ambiguous action.
- `Download` is a tracked cache workflow.
- `Download As` is an untracked export workflow after the export operation completes.
- Canceling a tracked download discards any partial progress in V1.
- Pause and resume are out of scope in V1.
- Tracked downloads are allowed only when the file is currently available from the provider.
- If an archived file is restoring, its tracked download state is `Restoring` until the provider reports it as available.
- `AvailableToDownload` means the file is provider-available and does not already have a current tracked cached copy.
- `Downloaded` means the tracked cache has the current file version.
- `NotDownloaded` means the file does not currently have a tracked cached copy and is not in an active restore workflow.
- The application must not claim a single global concurrent-download number across providers.
- Simultaneous tracked download capacity follows the active provider limitation.
- Outside active restore or tracked download workflows, the application must not poll automatically for updated listing state.
- Manual refresh remains the standard way to update cloud state when no monitored workflow is active.

## UX Expectations

- A user looking at the explorer should be able to understand whether a file still needs restore, is ready for tracked download, or is already cached.
- The bottom bar should act as a lightweight operational summary rather than as a second explorer.
- The modal should focus on active tracked download details, progress, and cancellation.
- Users should not expect paused downloads to resume later in V1.
- Manual refresh should stay discoverable so users understand that normal browsing is not continuously auto-updating.

## Acceptance Criteria

- A file can be represented with exactly one of the four documented tracked download states at a time.
- `Download` stores into local cache and is tracked by the app.
- `Download As` is not kept in the tracked-download monitor after the export flow ends.
- Active tracked downloads produce a bottom-bar summary affordance.
- Opening the summary affordance reveals a modal with tracked download details and cancellation actions.
- Canceling a tracked download removes the partial progress instead of keeping resumable state.
- No pause control is documented or required in the modal.
- The documented simultaneous tracked download behavior depends on the active provider limitation.
- The documented refresh model uses manual refresh by default and polling only while restores or tracked downloads are active.

## Out of Scope

- Pause and resume for tracked downloads
- Persistent queued-download UX beyond the provider-limited active set
- Tracking `Download As` history after export completion
- Permanent background polling during normal browsing
