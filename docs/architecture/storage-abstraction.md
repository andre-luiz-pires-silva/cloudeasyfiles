# Storage Abstraction

## Overview

Provider-specific storage tiers and availability behavior are normalized where that improves usability, while preserving provider-specific details where they matter operationally.

The same principle applies to listing and navigation: provider-native listing payloads are adapted into a shared explorer model, but the abstraction must stay honest about provider limitations such as continuation-based listing and flat namespaces.

## Provider Listing Normalization

AWS S3 and Azure Blob Storage may expose listing data in forms that are not directly suitable for the explorer UX.

Examples:

- flat object namespaces that must be interpreted as folders
- provider prefix-grouping structures
- folder-marker objects or blobs
- continuation tokens or markers instead of page numbers

The application must normalize these responses into navigable explorer entries before the UI consumes them.

Shared expectations:

- the explorer works with `File` and `Folder` entries
- the normalized explorer dataset is the source for UI rendering and counters
- raw provider item counts must not be reused as the displayed explorer count
- provider continuation details may be mapped into a uniform internal contract, but must not be exposed to the end user as UX terminology
- folder creation uses an explicit empty object/blob whose key ends with `/` when the provider model supports that representation
- listing normalization must merge prefix-derived folders and explicit trailing-slash sentinels into one explorer folder entry
- the hybrid folder model must remain valid for AWS S3 and Azure Blob Storage

## Listing Contract Expectations

The listing abstraction should support:

- current context identity: connection, container, logical path
- normalized loaded entries for the current context
- continuation state for requesting additional data
- an internal provider cursor or equivalent token when more data exists
- a reliable `has_more` style signal for the UI

The listing abstraction should not require:

- numbered pages
- exact global totals for the current directory
- user-configurable page size as part of V1 explorer UX

## StorageClass

`StorageClass` should retain the provider-native label when that is more operationally useful to the user.

Examples:

- AWS examples:
  - `STANDARD`
  - `STANDARD_IA`
  - `GLACIER`
  - `DEEP_ARCHIVE`
- Azure examples:
  - `Hot`
  - `Cool`
  - `Cold`
  - `Archive`

The current direction is to expose these provider-specific tier names directly in file listings so the UI stays transparent about what the provider is really using.

Cross-provider simplification should happen primarily through `AvailabilityStatus`, not by erasing the native storage tier label.

## AvailabilityStatus

`AvailabilityStatus` represents whether content can be used immediately.

Normalized states:

- `Available`
- `Archived`
- `Restoring`

Examples:

- AWS Glacier or Deep Archive content maps to `Archived`
- Azure Archive content maps to `Archived`
- AWS restore in progress maps to `Restoring`
- Azure rehydration in progress maps to `Restoring`

This is the preferred layer for cross-provider normalization in the file list.

## Restore Options

Restore options are provider-specific and must not be flattened into a fake universal abstraction.

AWS examples:

- `Expedited`
- `Standard`
- `Bulk`

Azure examples:

- `Standard`
- `High priority`

The UI should provide a shared restore entry point while adapting the available options to the selected provider.

## Restore Execution and Monitoring

- restore is triggered through the provider API
- restore is a single-file action
- restore status is tracked through polling
- polling occurs only while the relevant view is open
- manual refresh is also available
- status is shown directly in the file list

## Download Rule

Download is only allowed when the file is `Available`.

Once available, the existing download modes still apply:

- `CacheDownload`
- `DirectDownload`
