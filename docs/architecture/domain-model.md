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
- a navigable folder entry derived from normalized object-storage data

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
- `Folder` means a navigable domain entity over flat object storage
- `File` means a concrete provider object or blob
- `storage_class` may preserve the provider-native label for transparency in the UI
- `availability_status` is the preferred normalized cross-provider state
- provider-specific metadata may still be retained when needed
- a folder may be explicit, implicit, or both in provider data, but is exposed as a single folder entry in the UI

## Explorer Listing Model

The explorer must distinguish three different datasets:

- raw provider listing response
- normalized explorer entries
- filtered UI entries

### Raw Provider Listing Response

AWS S3 and Azure Blob Storage may return provider-native listing payloads that include:

- objects or blobs
- prefix-grouping structures such as `CommonPrefixes`
- explicit folder sentinel objects whose keys end with `/`
- continuation markers or cursor-like tokens
- provider-specific pagination metadata

This dataset is not a UI contract.

### Normalized Explorer Entries

The application must normalize provider responses into navigable explorer entries before rendering the main listing.

Explorer entries are the user-facing units of navigation:

- `File`
- `Folder`

Normalization may include:

- converting flat object namespaces into folder entries
- turning provider prefix-grouping responses into folder entries
- recognizing explicit folder sentinels whose keys end with `/`
- inferring folders from descendant object prefixes even when no explicit sentinel exists
- consolidating explicit and implicit representations of the same folder
- deduplicating visually equivalent entries

The explorer counter must use this normalized collection rather than the raw provider object count.

### Filtered UI Entries

When a local filter is active, the UI renders a filtered subset of the normalized loaded entries.

Implications:

- filtering does not redefine the loaded universe
- filtering does not change provider cursor state
- filtered counts and loaded counts are intentionally different concepts

## Local Cache Concepts

The local cache is a separate concern from cloud listing.

Relevant concepts:

- optional global `LocalCacheConfig`
- deterministic cache path mapping from cloud identity to local path
- file state resolution using cloud availability plus cached-file presence

The cache enriches UI state but never becomes the listing source.

## Download State Concepts

Tracked download behavior needs a user-facing state model that combines cloud availability with local cache presence.

Representative concept:

- `DownloadState`

Normalized states:

- `NotDownloaded`
- `Restoring`
- `AvailableToDownload`
- `Downloaded`

Interpretation rules:

- `NotDownloaded` means the app does not currently have a tracked local copy for that file and the file is not in an active restore workflow.
- `Restoring` means the provider reports that the file is being restored or rehydrated and cannot be treated as ready for tracked download yet.
- `AvailableToDownload` means the file does not have a current tracked local copy and is immediately eligible for the tracked `Download` action.
- `Downloaded` means the tracked local cache contains the current file version associated with the cloud item.
- `DownloadState` is a UX-oriented state distinct from raw provider storage tier labels.
- In the current AWS implementation, `DownloadState` is resolved from provider availability data plus whether the expected cached file exists locally.
- In the current AWS implementation, the tracked local path is rooted under a globally configured cache directory and a stable per-connection folder derived from `connection_id`.
- Direct export flows such as `Download As` do not create or update tracked local cache state after the export flow completes.
- A freshness or `Outdated` state is not part of the current tracked-download implementation.
