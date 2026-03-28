# Navigation Model

## Overview

CloudEasyFiles separates structural navigation from object browsing.

This is a deliberate product and architecture choice intended to keep the interface scalable and easier to reason about.

## Sidebar Scope

The left navigation tree is limited to higher-level structural items:

- saved connections
- buckets or containers

The tree must not render file objects.

Rationale:

- simplifies scanning and navigation
- reduces UI complexity in the sidebar
- avoids pushing object pagination concerns into the tree
- keeps structural context separate from object exploration

## Main Content Scope

The main content area is the primary place for browsing cloud objects.

When a connection is selected, the main panel shows:

- connection details and actions
- the currently loaded containers for that connection

When a container or virtual directory is selected, the main panel lists:

- immediate virtual subdirectories
- immediate files

Navigation happens one level at a time in the main panel.

Listing follows an incremental loading model rather than numbered pagination.

The current browsing path is represented with a breadcrumb that starts at the selected connection and continues through the active container and virtual directory path.

## Listing Continuation Model

Object storage providers such as AWS S3 and Azure Blob Storage expose continuation-based listing rather than classic page numbers.

Rules:

- V1 uses incremental loading with a `Carregar mais` action
- V1 does not use numbered pagination
- provider continuation tokens remain an internal implementation detail
- the UI exposes only whether more results can be requested in the current context
- when no more results are available, `Carregar mais` remains visible but disabled to represent the end of the available listing for that context

This keeps the UX honest without exposing provider-specific pagination jargon.

## Virtual Directories

Virtual directories are resolved dynamically from object key prefixes.

Rules:

- no real directory objects are assumed
- intermediate prefix segments become synthetic directory entries
- only the immediate level for the current path should be listed
- the visible listing is based on normalized navigable entries, not the raw provider payload

## Counting and Transparency

The explorer communicates only counts that are reliable for the current loaded dataset.

Rules:

- the UI reports loaded navigable entries, not a global total for the directory or container
- the UI must not promise total pages or total items based only on native provider listing
- counters are derived from normalized explorer entries after prefix grouping, virtual-folder creation, and deduplication
- the displayed loaded count may differ from the number of raw provider objects returned in one or more provider responses

Counter language:

- without local filter: `X itens carregados`
- with local filter: `X itens filtrados de Y carregados`

## Context Model

- The sidebar defines the current context.
- The main panel renders the navigable contents for that context.
- Object browsing should feel hierarchical without implying a real filesystem.
- Selecting a connection keeps the user at the structural level.
- Selecting a container moves the main panel into object browsing for that container.

## Scalability Implications

Keeping objects out of the tree improves scalability and keeps loading, pagination, and object-set complexity concentrated in the main listing where those concerns can be handled more explicitly.
