# Domain Model

## Core Concepts

CloudEasyFiles uses a provider-agnostic vocabulary so the application and UI can reason about cloud storage without depending directly on AWS or Azure SDK shapes.

## CloudContainer

`CloudContainer` represents the top-level storage namespace for a connection.

Examples:

- S3 bucket
- Azure Blob container

Purpose:

- define the root boundary for exploration
- provide a shared structural concept across providers
- connect a saved connection to a browsable namespace

Representative fields:

- `id`
- `provider`
- `name`
- `display_name`
- `connection_id`
- optional location metadata such as region

## CloudItem

`CloudItem` represents an entry shown in the main content listing.

It may be:

- a concrete file/object/blob
- a virtual directory derived from prefixes

Purpose:

- drive browsing in the main content area
- support metadata display and contextual actions
- separate provider storage objects from UI navigation structure

Representative fields:

- `container_id`
- `path`
- `name`
- `kind`
- `size`
- `etag`
- `last_modified`
- `storage_class`
- `availability_status`
- `provider_metadata`

## Interpretation Rules

- `path` is always logical and relative to the container
- `VirtualDirectory` means synthetic, prefix-derived navigation
- `File` means a concrete provider object or blob
- normalized fields should be preferred by the application layer
- provider-specific metadata may still be retained when needed

## Local Cache Concepts

The local cache is a separate concern from cloud listing.

Relevant concepts:

- optional `LocalCacheConfig`
- cache index mapping cloud paths to local paths
- file state resolution using cloud metadata plus cache metadata

The cache enriches UI state but never becomes the listing source.
