# CloudEasyFiles Project Index

## Summary

CloudEasyFiles is a desktop application for navigating and managing files across multiple cloud storage providers through a unified interface.

Current initial focus:

- AWS S3
- Azure Blob Storage
- structural navigation by connection and container
- central object browsing with virtual directories
- archival storage awareness and restore workflows
- optional local cache for tracked downloads

## Current Status

The project is in active architecture and feature-definition mode with AWS integration already shaping the product model. The documentation is organized to support spec-oriented development and AI-assisted implementation.

## Main Features

- saved cloud connections
- structural sidebar navigation
- central content listing
- virtual directory navigation
- simple local filtering
- provider-aware advanced search direction
- archival restore workflows
- tracked and direct downloads
- optional local cache

## Documentation Map

### Product

- [Product Vision](./docs/product/vision.md)
- [Product Principles](./docs/product/principles.md)
- [Roadmap](./docs/product/roadmap.md)

### Architecture

- [Architecture Overview](./docs/architecture/overview.md)
- [Domain Model](./docs/architecture/domain-model.md)
- [Navigation Model](./docs/architecture/navigation-model.md)
- [Storage Abstraction](./docs/architecture/storage-abstraction.md)
- [Search and Filter](./docs/architecture/search-and-filter.md)

### Decisions

- [ADR-001: No Objects in the Navigation Tree](./docs/decisions/ADR-001-no-objects-in-tree.md)
- [ADR-002: Separate Local Filter from Advanced Search](./docs/decisions/ADR-002-local-filter-and-advanced-search.md)
- [ADR-003: Provider Abstraction with Real Limitations](./docs/decisions/ADR-003-provider-abstraction-with-real-limitations.md)
- [ADR-004: Incremental Explorer Listing and Normalized Counts](./docs/decisions/ADR-004-incremental-explorer-listing-and-normalized-counts.md)

### Feature Specs

- [Folder Navigation](./features/folder-navigation/spec.md)
- [Central Listing](./features/central-listing/spec.md)
- [Simple Filter](./features/simple-filter/spec.md)
- [Advanced Search](./features/advanced-search/spec.md)

### Implementation Plans

- [Folder Navigation Plan](./features/folder-navigation/implementation-plan.md)
- [Central Listing Plan](./features/central-listing/implementation-plan.md)
- [Simple Filter Plan](./features/simple-filter/implementation-plan.md)
- [Advanced Search Plan](./features/advanced-search/implementation-plan.md)

## Scope Notes

- The sidebar is intentionally structural.
- Object browsing belongs in the main content area.
- `Filter` and `Advanced Search` are separate concepts.
- Provider abstraction must simplify usage without hiding real provider differences.
- Explorer listing uses incremental loading with `Carregar mais`, not numbered pages.
- Explorer counters reflect normalized navigable entries, not raw provider payload counts.

For strategic detail, architecture rules, decisions, and feature behavior, use the linked documents above instead of expanding this file again.
