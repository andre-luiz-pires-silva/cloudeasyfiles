# Search and Filter

## Terminology

CloudEasyFiles uses two distinct terms:

- `Filter`
- `Advanced Search`

They are intentionally different concepts.

## Filter

`Filter` is a UI-only refinement of the currently rendered dataset.

Rules:

- available in the sidebar and in the main content area
- client-side only
- operates only on currently visible items
- does not trigger provider calls
- does not perform global search

For the main content area, the filter applies only to the items currently visible for the active path.

## Advanced Search

`Advanced Search` is a separate, potentially remote workflow launched from a dedicated modal.

Rules:

- separate from `Filter`
- may trigger provider or API calls
- may expose provider-specific parameters
- is the extensible entry point for more powerful search behavior

## Provider Awareness

AWS S3 and Azure Blob Storage do not expose identical native search capabilities.

Implications:

- the application cannot assume a fully uniform search surface
- the UI should offer a shared modal entry point
- the modal must support provider-specific fields and behaviors
- provider adapters remain responsible for translating supported search parameters

## Design Intent

This separation keeps lightweight local refinement simple while leaving room for richer provider-aware search without overloading the basic browsing experience.
