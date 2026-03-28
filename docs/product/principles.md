# Product Principles

## Product Principles

- Prefer clarity over density.
- Favor common workflows over exposing every provider detail at once.
- Keep navigation understandable even when underlying cloud structures are large.
- Normalize concepts only when the abstraction is honest and useful.
- Do not hide provider limitations when they materially affect user behavior.

## UX Principles

- The sidebar should stay structurally focused and easy to scan.
- Deep object browsing should happen in the main content area.
- The selected context should be obvious.
- Status should be visible where the user is already looking.
- Long-running workflows should provide direct in-place feedback.
- Explorer list UX should communicate loaded items transparently without promising unreliable global totals.

## Navigation Principles

- The left tree defines context.
- The main area is the primary place for object exploration.
- The product presents folders as the navigable concept in the explorer.
- Folder existence may come from provider prefixes and from explicit trailing-slash entries created by the app.
- Navigation should proceed one level at a time.
- Listing continuation should use incremental loading with `Carregar mais`, not numbered pages.

## Search and Filtering Principles

- `Filter` is a lightweight local refinement of what is already visible.
- `Advanced Search` is a separate, more powerful provider-aware workflow.
- The product should not blur these two concepts.
- Local filter must not change the already loaded explorer universe or its continuation state.

## Storage and Availability Principles

- The cloud is always the source of truth.
- Local cache is optional and limited to downloaded files.
- Archived content should be clearly marked.
- Restore workflows should be simple even when provider behavior is not.

## Documentation Principles

- Product guidance belongs in product docs.
- Cross-cutting technical rules belong in architecture docs.
- durable design choices belong in ADRs.
- feature behavior belongs in feature specs and implementation plans.
