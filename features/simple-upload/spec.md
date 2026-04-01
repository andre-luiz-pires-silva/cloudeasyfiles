# Feature Spec: Simple Upload

## Objective

Define the first upload workflow as a simple way to send one or more local files to the currently open AWS bucket folder.

## Context

The product already supports cloud browsing, download monitoring, and provider-specific restore awareness. Upload should follow the same operational tone: simple, explicit, and honest about provider behavior.

## Functional Requirements

- Upload must be available when the user is browsing an AWS bucket root or folder.
- Upload must be triggerable by a toolbar button and by drag and drop onto the open content area.
- The current simple upload must accept one or more files from the picker or drag-and-drop payload.
- The destination key must be derived from the currently open bucket path plus the original file name.
- Upload must use globally configured default AWS parameters.
- The current simple upload MVP must support exactly one global AWS parameter: `StorageClass`.
- If one or more destination keys already exist, the UI must detect those conflicts before upload start and present a unified overwrite-resolution flow.
- Upload progress must appear in the existing transfer summary and transfer modal.
- Active uploads must support cancelation.
- After a successful upload to the currently open path, the explorer must refresh that context automatically.

## Business Rules

- The current simple upload workflow is AWS-only.
- The current simple upload workflow does not open a dedicated advanced-parameter window.
- The current simple upload workflow does not expose ACL, metadata, tags, encryption overrides, or custom content-type fields.
- The current upload monitor does not introduce a local queue or `pending` state.
- The current upload monitor does not impose a configurable concurrency limit.
- A single drag or picker action may start multiple uploads immediately.
- Conflict resolution remains explicit and user-driven even in batch mode.
- If the same upload batch contains duplicate destination keys, the UI keeps only the first item for that destination and informs the user.

## UX Expectations

- Upload should feel like a direct action on the currently open cloud folder.
- The toolbar button should make the action obvious even when the user does not use drag and drop.
- Dragging a file onto the content area should clearly indicate that the current folder is a valid drop target.
- Overwrite handling should feel coherent for batch uploads, avoiding a noisy cascade of browser confirms.
- Upload progress should reuse the same operational language already used for downloads.

## Acceptance Criteria

- A user in an AWS bucket root can upload one or more local files to that root.
- A user in an AWS subfolder can upload one or more local files to that folder.
- Drag and drop and file-picker upload both target the currently open folder.
- If the dropped or selected payload contains multiple files, the app creates one upload operation per file.
- If one or more destination objects already exist, the app shows a unified conflict modal that supports item-by-item decisions and apply-to-all decisions.
- Uploads appear in the footer summary and modal while in progress.
- An active upload can be canceled.
- A completed upload refreshes the current folder automatically when the user is still viewing that folder.

## Out of Scope

- Advanced upload window
- Local upload queue
- Pending upload state
- Explicit parallelism limit
- Azure upload support
