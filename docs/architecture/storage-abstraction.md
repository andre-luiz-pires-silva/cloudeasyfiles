# Storage Abstraction

## Overview

Provider-specific storage tiers and availability behavior are normalized where that improves usability, while preserving provider-specific details where they matter operationally.

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
