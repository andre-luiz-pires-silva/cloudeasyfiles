# Storage Abstraction

## Overview

Provider-specific storage tiers and availability behavior are normalized where that improves usability, while preserving provider-specific details where they matter operationally.

## StorageClass

`StorageClass` is a normalized representation of how content is stored.

Representative normalized states:

- `Standard`
- `Cool`
- `Cold`
- `Archived`

Examples:

- AWS Glacier-like storage maps to `Archived`
- Azure Archive maps to `Archived`

This abstraction is intentionally lossy at the application layer.

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
