# Product Vision

## Overview

CloudEasyFiles is a desktop application for browsing and managing files across multiple cloud storage providers through a unified interface.

The initial scope focuses on:

- AWS S3
- Azure Blob Storage

The product aims to simplify cloud storage workflows that are usually fragmented, operationally complex, and highly provider-specific.

## Problem

Cloud storage providers expose different models, terminology, and operational constraints. This becomes more difficult when users need to:

- work across multiple providers
- browse large object-storage namespaces
- understand archival availability states
- restore archived content before downloading it

Provider consoles often expose these workflows in a way that is technically complete but operationally awkward for day-to-day use.

## Vision

CloudEasyFiles should make cloud file management feel familiar, predictable, and efficient without pretending that all providers behave the same way.

The product should:

- present a coherent navigation model
- reduce provider-specific cognitive load
- normalize shared concepts where that helps usability
- preserve real provider differences where they matter
- support archival workflows in a way that is understandable to non-specialist users
- make restore cost and timing tradeoffs explicit before a user starts an archival retrieval

## Product Positioning

CloudEasyFiles takes inspiration from VSCode first, with pgAdmin and DBeaver as secondary references, but applies that interaction style to cloud object storage rather than code or databases.

The product is intentionally desktop-first and should feel:

- lightweight
- direct
- operationally practical
- visually simple

## Current Scope

The current product scope includes:

- saved cloud connections
- structural navigation by connection and container
- cloud-first listing behavior
- incremental explorer listing with `Carregar mais`
- folder navigation over flat object storage, backed by prefixes and explicit folder sentinels when created in the app
- simplified storage availability states
- AWS-specific restore workflows for archived objects, with room for future provider-specific variants
- tracked and direct download monitoring with optional globally configured local cache
- separation between quick local filtering and future advanced search

## Long-Term Direction

CloudEasyFiles should evolve toward a maintainable provider-aware platform for cloud file operations, not a thin wrapper around raw provider consoles.

The long-term direction includes:

- strong provider abstraction
- provider-specific workflows where abstraction would be misleading
- sustainable feature growth through specs
- explicit architectural decisions
- documentation that supports both human contributors and AI-assisted implementation
