# ADR-004: Incremental Explorer Listing and Normalized Counts

## Status
Accepted

## Context

CloudEasyFiles must browse providers such as AWS S3 and Azure Blob Storage, which expose continuation-based listing rather than classic numbered pages.

The product also presents folder-like navigation on top of object storage, which means the explorer UI cannot rely directly on raw provider listing payloads or raw object counts.

Without an explicit decision, the product risks:

- implying numbered pagination that providers do not naturally support
- exposing page-size controls that add technical noise without improving V1 UX
- showing counters based on raw provider payloads rather than actual navigable entries
- implying exact global totals for a directory when native listing does not provide that reliably

## Decision

CloudEasyFiles adopts the following explorer-listing rules for V1:

- listing uses incremental loading with a `Carregar mais` action
- V1 does not use numbered pagination
- provider continuation tokens, cursors, and markers remain internal implementation details
- `Carregar mais` stays visible as the continuation action and becomes disabled when no more data is available in the current context
- the explorer counter is based on normalized navigable entries, not raw provider objects or blobs returned by the provider
- local filter is applied only in memory over the already loaded normalized explorer entries
- local filter does not change the loaded universe, the provider cursor, or the continuation logic
- the UI does not expose page size or batch size as a user-configurable search or explorer option in V1
- the UI communicates loaded items and filtered items, but does not promise an exact global total for the current provider directory or container based only on native listing

## Alternatives Considered

- Numbered pagination in the explorer
- Infinite scroll as the primary V1 continuation model
- User-configurable page size in explorer or advanced search controls
- UI counters based directly on raw provider response lengths
- Displaying an assumed global total for the directory from native listing alone

## Consequences

- The explorer UX matches the continuation-based reality of S3, Azure Blob Storage, and likely future object-storage providers
- The UI stays transparent by exposing only what is reliable for the current loaded dataset
- Provider adapters must normalize raw listing responses into navigable explorer entries before rendering or counting
- Explorer counters may differ from raw provider object counts because of prefix grouping, hybrid folder representation, folder markers, and deduplication
- Testing must distinguish raw provider responses, normalized loaded entries, and filtered displayed entries
- Future providers can implement their own continuation mechanics behind the same internal contract without forcing numbered pages into the UX
