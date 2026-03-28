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
- operates only on already loaded items for that area
- does not trigger provider calls
- does not perform global search
- does not reset or redefine the loaded universe
- does not change continuation cursor state or listing pagination logic

For the main content area, the filter applies only to the normalized loaded explorer entries for the active path.

## Main Explorer Counter Semantics

In the main content area, filter state changes the displayed subset but not the loaded dataset.

Rules:

- without local filter, the counter uses `X itens carregados`
- with local filter, the counter uses `X itens filtrados de Y carregados`
- `Y` is the number of normalized navigable entries already loaded for the current context
- `X` is the subset currently shown after local filtering
- the counter does not claim a global total of items in the provider directory or container

Even with a local filter active, `Carregar mais` remains valid whenever the provider still has more data for the current context.

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
