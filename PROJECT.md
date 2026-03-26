# CloudEasyFiles Project Reference

## Overview

CloudEasyFiles is a desktop application for managing files stored in cloud providers through a unified, intuitive, and user-friendly interface.

Its primary goal is to simplify cloud storage interactions that are often fragmented, provider-specific, and operationally complex. The application should present a consistent experience across supported providers, allowing users to work with cloud files in a way that feels familiar, efficient, predictable, and easy to learn.

This project is also intentionally designed as portfolio-quality software. It should demonstrate strong engineering discipline, clean architecture, maintainable code, and thoughtful product design.

## Purpose

CloudEasyFiles exists to make cloud file management accessible through a desktop experience that abstracts away low-level provider details.

The application should help users:

- Connect multiple cloud accounts
- Browse storage resources through a structured interface
- Perform common file operations in a unified way
- Understand file availability and storage state at a glance
- Work with archival storage without needing deep provider-specific knowledge
- Navigate saved cloud connections and resources with minimal friction

## Core Product Concept

CloudEasyFiles should behave similarly to VSCode first, with pgAdmin and DBeaver as secondary references, but for cloud storage rather than source code or databases.

The interface should appeal through simplicity and ease of use. The goal is not to expose every provider concept upfront, but to guide the user through a clear navigation model with contextual information and actions.

The expected interaction model is:

- A tree-based navigation sidebar on the left
- Saved AWS and Azure connections persisted in that tree
- Hierarchical nodes for accounts, buckets, containers, folders, and files
- A main content area that updates according to the selected node
- Detailed information about the selected node in the main area
- Contextual actions and features that make sense for the selected node
- A central explorer experience for file and folder content when applicable
- Clear visual status for operations and storage state

Users should be able to register multiple cloud accounts, navigate them through a common interface, and operate on files without needing to learn the specific API model of each provider.

## Initial Provider Scope

The first supported cloud providers are:

- AWS S3, including Glacier-related workflows
- Azure Blob Storage, including Hot, Cool, and Archive tiers

The design must remain extensible so additional providers can be added later without forcing major changes to the core application layers.

## Object Storage Model

CloudEasyFiles operates on top of object storage systems, not traditional hierarchical file systems.

- AWS S3 stores objects in buckets
- Azure Blob Storage stores blobs in containers
- Neither provider exposes real directories as first-class filesystem entities
- Folder structures are virtual and inferred from object naming conventions

This distinction is central to both product behavior and technical design. The UI presents a familiar tree and explorer because users expect folder-oriented navigation, but the underlying model must remain faithful to object storage semantics.

### Virtual Directories

Virtual directories are synthetic entries derived from object key prefixes.

Examples:

- `reports/2026/january.csv`
- `reports/2026/february.csv`

In the UI, these keys may be presented as:

- `reports/`
- `reports/2026/`
- `reports/2026/january.csv`
- `reports/2026/february.csv`

The directory nodes above are not persisted cloud resources. They are interpreted views over prefixes.

### Prefix-Based Hierarchy

The hierarchy shown by the application is resolved through prefix parsing:

- A container is the top-level physical storage namespace
- A delimiter-aware prefix scan produces virtual directory nodes
- Leaf entries that represent concrete objects become file items
- Intermediate segments become virtual directory items

This means path interpretation must be deterministic and provider-agnostic:

- `container + path` identifies a logical cloud location
- Paths must be normalized consistently across providers
- A virtual directory path does not imply a corresponding cloud object exists
- A file path maps to a concrete provider object or blob

## Unified Data Model

The application uses a shared domain vocabulary so the UI and application layer can remain provider-agnostic.

### CloudContainer

`CloudContainer` represents the top-level storage unit for a provider connection.

Examples:

- S3 bucket
- Azure blob container

Purpose:

- Provide a unified representation of the root namespace being explored
- Decouple the rest of the application from provider-specific naming
- Act as the boundary between connection context and item listing

Suggested fields:

- `id`
- `provider`
- `name`
- `display_name`
- `region` or provider-specific location metadata when available
- `connection_id`

### CloudItem

`CloudItem` represents an entry shown in the explorer.

It can model:

- A concrete file/object/blob
- A virtual directory derived from prefixes

Purpose:

- Provide a single explorer-facing shape for all providers
- Support navigation, selection, metadata display, downloads, and status resolution
- Separate physical cloud objects from UI navigation structure without leaking provider APIs into the UI

Suggested fields:

- `container_id`
- `path`
- `name`
- `kind`
  - `File`
  - `VirtualDirectory`
- `size`
- `etag`
- `last_modified`
- `storage_class`
- `availability_status`
- `provider_metadata`

Interpretation rules:

- `path` is the logical cloud path relative to the container
- `kind = VirtualDirectory` means the item is synthetic and prefix-derived
- `kind = File` means the item corresponds to a provider object/blob
- Provider-specific metadata may exist, but normalized fields must be preferred by the application layer

## Functional Requirements

### Account Management

- Support multiple AWS accounts
- Support multiple Azure accounts
- Allow users to register and manage connections cleanly
- Persist configured connections in the navigation tree for easy reuse

### Navigation and Exploration

- Provide a tree-based navigation panel on the left side
- Use VSCode as the main interaction reference for the navigation model
- Show saved connections, accounts, buckets, containers, and related hierarchical resources
- Update the main area based on the selected node
- Present node details and context-aware actions in the main area
- Present a central file explorer panel for browsing content when the selected node supports it

### File Operations

The application must support a unified workflow for:

- Upload
- Download
- Delete
- Copy
- Move

These operations should be expressed consistently in the UI regardless of cloud provider.

Downloads require explicit handling because the application supports both tracked cache downloads and untracked direct downloads.

### Visual Feedback

The application should provide clear operational feedback, including:

- Progress bars for long-running actions
- Status indicators for success, failure, pending work, and in-progress work
- Clear display of file availability state
- A straightforward, low-friction interface that prioritizes comprehension over density

### Storage Tier Awareness

The system must understand whether content is immediately available or archived and must surface that information clearly in the user interface.

The application should normalize provider terminology into shared states wherever possible so that users see a consistent conceptual model.

## Advanced Requirement: Archival Storage Handling

One of the most important differentiators of CloudEasyFiles is simplifying archival storage workflows.

### AWS Requirements

For AWS S3:

- Detect Glacier-related storage states
- Allow users to request restore operations
- Track restore status
- Allow download only when the object is actually available

### Azure Requirements

For Azure Blob Storage:

- Detect Archive tier blobs
- Allow users to trigger rehydration
- Track rehydration progress or status
- Reflect real availability in the UI

### UX Requirement

Users should not need to understand the provider-specific complexity behind archival operations. The system must translate that complexity into a simple, understandable experience.

## Architecture Principles

CloudEasyFiles must follow high-quality software engineering standards.

### Core Principles

- Clean architecture
- Strong separation of concerns
- High cohesion and low coupling
- Extensibility for future providers
- Explicit boundaries between application layers

### Architectural Intent

The codebase should be organized so the business intent of the application remains understandable even as integrations grow in complexity.

The architecture must protect the core application from direct dependence on provider-specific APIs and edge cases.

## Provider Abstraction Strategy

A central architectural requirement is provider abstraction.

The system must define a unified interface, trait, or abstraction for core file operations and storage behaviors.

Requirements:

- The core application depends on abstractions, not concrete providers
- Each provider implements the common abstraction
- AWS-specific behavior remains isolated in AWS modules
- Azure-specific behavior remains isolated in Azure modules
- The application layer orchestrates workflows without embedding provider details

This separation is essential for maintainability, testability, and long-term extensibility.

### Provider Abstraction Layer

The provider abstraction layer is the contract boundary between the core application and cloud-specific implementations.

Architectural expectations:

- The application layer depends on traits or interfaces defined in the core/domain boundary
- Provider implementations translate provider APIs into shared domain models such as `CloudContainer`, `CloudItem`, `StorageClass`, and `AvailabilityStatus`
- AWS and Azure modules remain isolated and can evolve independently
- The UI never reasons directly in terms of S3 SDK responses or Azure SDK blob models

Expected provider responsibilities behind the abstraction:

- List containers
- List items by logical path/prefix
- Read object metadata
- Upload and download file content
- Delete, copy, and move items
- Trigger restore or rehydration flows
- Resolve provider-specific metadata into normalized states

This keeps the core application provider-agnostic and makes it possible to add future providers without rewriting orchestration or presentation logic.

## Layer Responsibilities

### Core Layer

The core layer is responsible for:

- Orchestrating operations
- Coordinating workflows across the system
- Managing generic progress tracking
- Managing UI-facing state transitions
- Handling generic errors and application-level rules
- Resolving file state from cloud metadata and cache metadata
- Coordinating tracked and untracked download workflows

This layer must not contain provider-specific implementation logic.

### Provider Layer

The provider layer is responsible for:

- AWS-specific implementation details
- Azure-specific implementation details
- Communication with provider SDKs and APIs
- Translation between provider responses and internal models
- Handling provider-specific edge cases
- Translation of storage classes and availability states into normalized abstractions

### Presentation Layer

The presentation layer is responsible for:

- Desktop UI behavior
- User interactions
- Rendering explorer state
- Presenting progress and status information
- Triggering application use cases through well-defined interfaces

### Infrastructure Layer

The infrastructure layer should contain:

- HTTP integrations
- SDK wiring
- Serialization support
- Persistence and configuration storage
- Platform-specific integration details
- Local cache persistence and metadata index storage

## Storage and Availability Abstractions

Provider-specific storage tiers must be normalized into shared abstractions so the rest of the application can reason about file availability without branching on provider-specific terminology.

### StorageClass

`StorageClass` is a normalized representation of how content is stored.

Representative normalized states may include:

- `Standard`
- `Cool`
- `Cold`
- `Archived`

Examples of normalization:

- AWS Glacier-like tiers map to `Archived`
- Azure Archive maps to `Archived`

This abstraction is intentionally lossy at the application layer. Detailed provider-specific metadata can still be preserved for diagnostics or advanced UI, but general workflows should rely on normalized values.

### AvailabilityStatus

`AvailabilityStatus` represents whether content can be read immediately.

Representative normalized states may include:

- `Available`
- `Archived`
- `Restoring`

Examples:

- AWS object in Glacier and not yet restored -> `Archived`
- AWS restore in progress -> `Restoring`
- Azure blob in Archive tier -> `Archived`
- Azure rehydration in progress -> `Restoring`

The UI and orchestration layer should mostly depend on `AvailabilityStatus`, not raw provider storage labels.

## Local Cache Strategy

Local cache is a deliberate product feature, not an implicit side effect of downloads.

### Core Rules

- Local cache is optional per connection
- Local cache is only used for downloaded files
- Local cache is not a synchronization system
- Local cache does not change the fact that the cloud is the source of truth

### LocalCacheConfig

Each connection may optionally define a `LocalCacheConfig`.

Purpose:

- Opt a connection into tracked local downloads
- Define where cache files are stored on the local machine
- Enable file state indicators such as `Downloaded` and `Outdated`

Suggested fields:

- `enabled`
- `base_directory`
- `connection_id`
- Optional cache behavior flags in the future

### Cache Index

Filesystem presence alone is insufficient to determine whether a local file corresponds to a cloud file and whether it is current.

The application therefore requires a cache index that maps cloud items to local cached files.

The index should map:

- `connection_id`
- `container`
- `cloud_path`
- `local_path`

Associated metadata should include:

- `etag`
- `last_modified`
- `size`
- `downloaded_at`

Optional additional metadata may include:

- `provider`
- `storage_class`
- hash/checksum values when useful

### Why Filesystem-Only Tracking Is Insufficient

Relying only on local filesystem inspection is not enough because:

- The app cannot infer the original cloud path from an arbitrary local filename
- Users may rename, move, or duplicate files outside the application
- File timestamps alone are not reliable cross-provider freshness indicators
- A file existing on disk does not prove it matches the current cloud object version

A metadata-backed cache index is therefore required for correct state resolution.

## Source of Truth

The cloud provider is always the source of truth.

Implications:

- Local files are cache copies only
- There is no conflict resolution between local and cloud versions
- There is no bidirectional sync model
- Local file edits do not automatically become uploads
- Explorer listing is always resolved from the cloud, not from local cache contents

This decision simplifies product expectations and keeps architecture aligned with the actual use case.

## Download Strategy

Downloads must support two explicit modes.

### DownloadMode

Representative download modes:

- `CacheDownload`
- `DirectDownload`

### Cache Download

Used when a connection has local cache enabled and the user chooses the standard download flow.

Flow:

1. Resolve the selected `CloudItem` from the cloud context
2. Download the file into the configured cache directory
3. Update or insert cache index metadata
4. Mark the file as locally tracked
5. Surface the resulting local file state as `Downloaded`

Rules:

- Only valid for file items, not virtual directories
- The resulting local file participates in state tracking
- Future cloud metadata comparisons may mark the item as `Outdated`

### Direct Download

Used when the user chooses `Download As` or when no local cache is configured and the user confirms a manual download.

Flow:

1. Ask the user for a destination path
2. Download the selected cloud file directly to that location
3. Do not write cache index metadata
4. Do not enroll the file into tracked local state

Rules:

- Direct downloads are ignored by the cache tracking system
- The system does not later treat those files as downloaded cache entries
- This mode behaves like a one-off export rather than managed local storage

## Local File State Tracking

The UI should present a simple normalized local file state derived from cloud metadata and cache metadata.

### LocalFileState

Representative states:

- `NotDownloaded`
- `Downloaded`
- `Outdated`

### State Resolution Logic

State resolution depends on both cloud data and cache index data.

Rules:

- If there is no cache entry for a file, state is `NotDownloaded`
- If there is a cache entry and the cached metadata matches current cloud metadata, state is `Downloaded`
- If there is a cache entry but the cloud metadata no longer matches, state is `Outdated`

Signals used for comparison may include:

- `etag`
- `last_modified`
- `size`

The exact comparison strategy should be consistent across providers and based on normalized metadata where possible.

## File Listing Behavior

Listing behavior must remain cloud-first.

Rules:

- Containers and items are always listed from the cloud provider
- Virtual directories are derived from provider listing results
- Local cache never becomes the source for explorer contents
- Local cache only enriches listed items with local state information

This preserves the source-of-truth decision and prevents the explorer from drifting into accidental synchronization behavior.

## Explicit Non-Goals

The following are intentionally out of scope for the current product and architecture:

- No automatic synchronization
- No bidirectional sync
- No automatic upload of changed local files
- No filesystem watchers for synchronization
- No local-first offline mode that later reconciles against the cloud

These boundaries should shape implementation decisions. If a feature proposal starts to imply conflict resolution, local mutation tracking, or reconciliation logic, it is outside the current scope unless the project direction is deliberately changed.

## Architecture Impact

The architecture must explicitly separate cloud integration, cache handling, and orchestration.

### Updated Layering

- Cloud providers
  - AWS and Azure implementations behind provider abstractions
- Local cache layer
  - Cache configuration, cache index persistence, and local file metadata handling
- Application layer
  - Workflow orchestration, download decisions, file state resolution, and UI-facing use cases
- Presentation layer
  - User interactions, status display, and command invocation

### New or Clarified Services

`CacheService`

- Owns cache index reads and writes
- Resolves local cache paths
- Persists metadata for tracked downloads

`DownloadService`

- Orchestrates `CacheDownload` versus `DirectDownload`
- Depends on provider abstraction plus cache services
- Ensures only cache downloads become tracked files

`FileStateResolver`

- Combines cloud metadata and cache metadata
- Produces `NotDownloaded`, `Downloaded`, or `Outdated`
- Keeps state resolution logic out of UI components and provider adapters

## Technology Stack

### Desktop Framework

- Tauri

### Backend

- Rust

### Frontend

- React
- TypeScript
- Vite
- CSS

### Async Runtime

- Tokio

### Serialization

- Serde

### HTTP

- Reqwest

### Cloud SDKs

- AWS SDK for Rust for S3 integration
- Azure SDK for Rust for Blob Storage integration

## Design Goals

CloudEasyFiles should aim for the following product and engineering qualities:

- Lightweight desktop footprint
- Modern and polished UI/UX
- High performance
- Safety and reliability through Rust
- Clear maintainability over time
- Strong architectural consistency

The project should avoid unnecessary complexity and should not drift toward Electron-like overhead when a leaner approach is available.

## Frontend Architecture Direction

The frontend has adopted a minimal `React + TypeScript + Vite` stack.

This choice is intended to support richer UI composition and more complex state transitions without introducing unnecessary framework overhead.

### Frontend Constraints

- Prefer React built-ins before adding external libraries
- Use local component state by default
- Introduce `useContext` only for truly shared global concerns
- Avoid state-management libraries unless the native React model becomes insufficient
- Avoid adding routing, form, or data-fetching libraries before there is clear product pressure for them
- Keep Tauri command access isolated from presentation components

### Preferred Frontend Structure

The frontend should remain organized around a small number of folders with explicit responsibilities:

- `src/app/` for root app composition and global providers
- `src/lib/i18n/` for localization logic
- `src/lib/tauri/` for Tauri command wrappers
- `src/locales/` for translation catalogs
- `src/features/` for future feature-specific UI and logic as the application grows

The intent is to scale by adding feature-oriented modules, not by introducing multiple generic layers prematurely.

## Code Quality Requirements

This project is intended to represent professional-level engineering quality.

All code generated for this repository must:

- Follow clean architecture principles
- Be modular and well organized
- Use clear names and understandable structure
- Avoid hacks, shortcuts, and prototype-style solutions
- Be production-quality in style and intent
- Be maintainable by future contributors

## Learning Context

The primary developer has strong experience with Java and is newer to Rust and Tauri.

This means the codebase should favor:

- Clarity over cleverness
- Readable structure over dense patterns
- Brief explanations where they help understanding
- Incremental complexity rather than unnecessary abstraction too early

When introducing Rust-specific or Tauri-specific patterns, prefer solutions that are easy to reason about and extend.

## Project Constraints

The project must adhere to the following constraints:

- It must be open source
- It must use the MIT License
- It must target cross-platform desktop support
- It should support Windows, macOS, and Linux

## Future Vision

Potential future enhancements include:

- Support for additional providers such as Google Cloud Storage
- Drag-and-drop interactions
- File preview capabilities
- Search functionality
- Additional cache ergonomics and performance improvements

These features should be considered in architectural decisions, especially where extensibility and reusable abstractions are involved.

## Guidance for AI Assistants

This document is the single source of truth for the project context.

When generating code, suggestions, architecture changes, or documentation for CloudEasyFiles, AI assistants must follow these rules:

1. Respect the architecture principles defined here.
2. Never mix provider-specific logic into the core application layer.
3. Prefer clarity over cleverness.
4. Produce production-ready code rather than prototype-style output.
5. Maintain consistency with the goals, boundaries, and terminology in this document.

## Practical Interpretation for Contributors

When in doubt:

- Put shared concepts in the core or domain-oriented layers
- Put provider API details behind abstractions
- Keep the UI focused on presentation and interaction
- Keep orchestration in application-level services or use cases
- Optimize for readability, maintainability, and extension

## Document Role

`PROJECT.md` should be treated as the primary contextual reference for:

- New contributors
- Architecture discussions
- Code generation tasks
- AI-assisted development
- Future planning and scope alignment

If code, documentation, or design decisions drift from this document, they should be reviewed and corrected intentionally.
