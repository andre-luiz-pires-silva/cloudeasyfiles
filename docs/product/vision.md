# Product Vision

## Overview

CloudEasyFiles is a desktop application for backup, archive access, and file management across cloud storage providers.

The initial scope focuses on:

- AWS S3
- Azure Blob Storage

The product aims to simplify the use of cloud storage services that are reliable and low cost, but often difficult for normal users to access through provider consoles.

## Problem

People need backups, but the usual alternatives are not ideal. External drives have upfront cost, can fail, and are easy to lose or damage. Cloud providers offer better durability and very low-cost archive storage, but their tooling is often hard to understand.

This becomes more difficult when users need to:

- set up storage accounts correctly
- browse large object-storage namespaces
- understand whether a file is ready to download
- restore or rehydrate archived content before downloading it

Provider consoles often expose these workflows in a way that is technically complete but difficult for day-to-day use.

## Vision

CloudEasyFiles should make cloud backup and archive storage feel easier to use without hiding important provider differences.

The product should:

- make backup-oriented cloud storage easier to understand
- reduce the effort required to browse, restore, and download files
- use simple language where provider consoles are too technical
- preserve provider differences where they matter to cost, timing, or availability
- support archival workflows in a way that is understandable to non-specialist users
- make restore cost and timing tradeoffs clear before a user starts an archival retrieval

## Product Positioning

CloudEasyFiles is positioned as a practical desktop tool for people who want to use cloud storage for backup and recovery without learning every detail of each provider console.

The product should feel:

- direct
- easy to understand
- practical for real backup and restore work
- simple enough for non-specialist users

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

CloudEasyFiles should evolve toward a maintainable platform for cloud backup and file operations, not a thin wrapper around raw provider consoles.

The long-term direction includes:

- support for more providers over time
- provider-specific workflows where abstraction would be misleading
- sustainable feature growth through specs
- explicit architectural decisions
- documentation that supports both human contributors and AI-assisted implementation
