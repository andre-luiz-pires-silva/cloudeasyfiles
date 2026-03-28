# ADR-005: Hybrid Folder Representation for Object Storage

## Status
Accepted

## Context

CloudEasyFiles presents a folder-oriented explorer on top of object storage providers such as AWS S3 and Azure Blob Storage.

These providers use a flat namespace. They may expose:

- ordinary objects or blobs
- prefix-grouping data for one-level browsing
- explicit folder-marker objects whose keys end with `/`

Earlier documentation leaned too heavily on the idea of folders as only prefix-derived virtual directories. That is not sufficient for the product direction.

The app must align more closely with what users already see in the AWS S3 console, where explicit folder creation is commonly represented by an empty object with a trailing slash key. At the same time, folder existence cannot depend exclusively on that sentinel object, because descendant objects may imply a folder path even when no sentinel was created.

## Problem

The project needs one durable rule for representing folders across providers without:

- pretending object storage has real filesystem directories
- losing compatibility with explicit folder creation in AWS S3
- hiding folders that exist implicitly through descendant object prefixes
- showing duplicate folder rows when both representations exist
- blocking future Azure Blob Storage support

## Decision

CloudEasyFiles adopts a hybrid folder model for object storage providers:

- The product domain exposes a navigable `Folder` concept.
- A folder may be explicit through an empty object/blob whose key ends with `/`.
- A folder may be implicit when descendant objects exist under the corresponding prefix.
- Creating a folder in the app writes the explicit trailing-slash sentinel representation.
- Listing logic must normalize provider responses into folder and file entries.
- Listing logic must merge equivalent explicit and implicit folder representations into one visible folder entry.
- The UI presents the result simply as a folder, without emphasizing internal terms such as virtual folder or folder marker.

## Alternatives Considered

- Prefix-only folders with no explicit sentinel creation
- Sentinel-only folders that exist only when the trailing-slash object exists
- Provider-specific folder semantics in the UI

## Consequences

- Folder creation has a concrete provider-side representation that matches common S3 expectations.
- Browsing remains correct when folders exist only implicitly through descendant content.
- Provider adapters must normalize mixed response shapes, including prefix-grouping data and trailing-slash sentinel objects.
- Explorer counters and rows must be based on deduplicated normalized entries rather than raw provider payload counts.
- Folder deletion, rename, move, and copy flows must distinguish between the explicit sentinel object and descendant contents.
- The UX stays simple because users see only folders, not the storage-model mechanics behind them.

## Multi-Provider Compatibility

- AWS S3 is directly compatible with this model through flat keys, prefixes, delimiters, and trailing-slash marker objects.
- Azure Blob Storage is also compatible because blob names are flat, prefix-based browsing is supported, and explicit trailing-slash marker blobs can participate in the same normalization model.
- The shared abstraction is the hybrid folder rule, not a claim that providers expose real directory entities.
