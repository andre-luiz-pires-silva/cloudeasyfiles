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
- `storage_class` may preserve the provider-native label for transparency in the UI
- `availability_status` is the preferred normalized cross-provider state
- provider-specific metadata may still be retained when needed

## Explorer Listing Model

The explorer must distinguish three different datasets:

- raw provider listing response
- normalized explorer entries
- filtered UI entries

### Raw Provider Listing Response

AWS S3 and Azure Blob Storage may return provider-native listing payloads that include:

- objects or blobs
- prefix-grouping structures such as `CommonPrefixes`
- continuation markers or cursor-like tokens
- provider-specific pagination metadata

This dataset is not a UI contract.

### Normalized Explorer Entries

The application must normalize provider responses into navigable explorer entries before rendering the main listing.

Explorer entries are the user-facing units of navigation:

- `File`
- `VirtualDirectory`

Normalization may include:

- converting flat object namespaces into virtual directories
- turning provider prefix-grouping responses into directory entries
- ignoring or consolidating folder markers
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

- optional `LocalCacheConfig`
- cache index mapping cloud paths to local paths
- file state resolution using cloud metadata plus cache metadata

The cache enriches UI state but never becomes the listing source.
