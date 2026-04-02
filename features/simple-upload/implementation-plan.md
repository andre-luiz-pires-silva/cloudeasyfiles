# Implementation Plan: Simple Upload

## Summary

Implement a simple AWS upload flow in the navigator using the existing Tauri bridge and transfer-monitor pattern. The workflow sends one or more local files to the open bucket path, uses the connection's default AWS storage class, resolves overwrite conflicts in a unified batch modal, supports cancelation, and refreshes the current listing on success.

## Frontend

- Extend AWS connection settings with `defaultUploadStorageClass`.
- Add an AWS connection form control for the default upload storage class.
- Add a toolbar upload button for AWS bucket contexts.
- Register native drag-and-drop handling for the content panel and support multi-file drops.
- Reuse the existing transfer footer and modal to display active uploads beside downloads.
- Reuse the existing completion toast pattern for successful uploads and transfer errors.
- Add a batch conflict-resolution modal for duplicate destination objects with per-item and apply-to-all actions.

## Tauri Bridge and Backend

- Add `aws_object_exists` to preflight overwrite conflicts.
- Add `start_aws_upload` and `cancel_aws_upload`.
- Emit `aws-upload-progress` events with `operationId`, destination object key, local file path, transferred bytes, total bytes, percent, state, and error.
- Implement AWS upload in `AwsConnectionService`, including multipart upload when the file exceeds the internal single-request threshold.
- Keep upload cancelation separate from download cancelation while preserving the same `operationId` pattern.

## Behavior

- Derive the destination key from the current logical path and the selected file name.
- Preflight all selected files for destination conflicts before starting uploads.
- Resolve overwrite conflicts through one modal that can continue item by item or apply one decision to the remaining conflicts.
- Start uploads immediately after conflict resolution.
- Do not create a local queue, `pending` state, or configurable concurrency limit in this phase.
- Refresh the currently open folder automatically after a successful upload to that same folder.

## Verification

- `npm run build`
- `cargo check`
- Manual checks for picker upload, drag-and-drop upload, batch conflict resolution, upload cancelation, toast-based error reporting, and auto-refresh on success
