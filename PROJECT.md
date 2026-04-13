# CloudEasyFiles Project Index

## Summary

CloudEasyFiles is a desktop application for navigating and operating on cloud storage through a unified interface. The repository is organized as a product-quality codebase with supporting architecture docs, ADRs, feature specs, and implementation plans.

Current provider support in the codebase:

- AWS S3
- Azure Blob Storage

## Current Implementation State

Current repository state includes:

- saved connections for AWS and Azure
- structural sidebar navigation by connection and container
- central object browsing with folder-style navigation
- incremental listing with provider continuation hidden behind the UI
- uploads, tracked downloads, and direct downloads
- delete and folder creation workflows
- tier changes for both providers
- AWS archived-object restore requests
- Azure Archive rehydration requests
- local cache awareness and transfer monitoring

The codebase and the feature-specific docs remain the source of truth for implementation details, but the current release line now includes both AWS and Azure support.

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
- [ADR-005: Hybrid Folder Representation for Object Storage](./docs/decisions/ADR-005-hybrid-folder-representation-for-object-storage.md)
- [ADR-006: Provider-Specific Restore with No Local History](./docs/decisions/ADR-006-provider-specific-restore-with-no-local-history.md)

### Feature Specs

- [Folder Navigation](./features/folder-navigation/spec.md)
- [Central Listing](./features/central-listing/spec.md)
- [Download Management](./features/download-management/spec.md)
- [File Restore](./features/file-restore/spec.md)
- [Simple Filter](./features/simple-filter/spec.md)
- [Advanced Search](./features/advanced-search/spec.md)
- [Simple Upload](./features/simple-upload/spec.md)

### Implementation Plans

- [Azure Support](./features/azure-support/implementation-plan.md)
- [Folder Navigation Plan](./features/folder-navigation/implementation-plan.md)
- [Central Listing Plan](./features/central-listing/implementation-plan.md)
- [File Restore Plan](./features/file-restore/implementation-plan.md)
- [Simple Filter Plan](./features/simple-filter/implementation-plan.md)
- [Advanced Search Plan](./features/advanced-search/implementation-plan.md)
- [Simple Upload Plan](./features/simple-upload/implementation-plan.md)

### Release Notes

- [Release 0.2.0](./docs/releases/0.2.0.md)
- [Release 0.1.0](./docs/releases/0.1.0.md)
- [Changelog](./CHANGELOG.md)

## Repository Conventions

- Public project overview lives in [`README.md`](./README.md)
- Architecture intent belongs in `docs/architecture`
- Product framing belongs in `docs/product`
- Decision records belong in `docs/decisions`
- Feature behavior and implementation planning belong in `features/*`
- Repository process and collaboration expectations live in:
  - [`CONTRIBUTING.md`](./CONTRIBUTING.md)
  - [`SECURITY.md`](./SECURITY.md)

## Quality Baseline

Current repository baseline:

- `npm run build`
- `cargo check`
- pull request template with validation checklist
- GitHub Actions CI for push and PR
- tag-based release publishing for Linux and Windows installers

For implementation details, prefer the linked docs over expanding this file into a second README.
