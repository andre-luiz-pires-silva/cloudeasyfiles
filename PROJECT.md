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

### Visual Feedback

The application should provide clear operational feedback, including:

- Progress bars for long-running actions
- Status indicators for success, failure, pending work, and in-progress work
- Clear display of file availability state
- A straightforward, low-friction interface that prioritizes comprehension over density

### Storage Tier Awareness

The system must understand whether content is immediately available or archived and must surface that information clearly in the user interface.

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

## Layer Responsibilities

### Core Layer

The core layer is responsible for:

- Orchestrating operations
- Coordinating workflows across the system
- Managing generic progress tracking
- Managing UI-facing state transitions
- Handling generic errors and application-level rules

This layer must not contain provider-specific implementation logic.

### Provider Layer

The provider layer is responsible for:

- AWS-specific implementation details
- Azure-specific implementation details
- Communication with provider SDKs and APIs
- Translation between provider responses and internal models
- Handling provider-specific edge cases

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
- Synchronization features

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
