# Product Roadmap

## Current Phase

The current phase is focused on building a clear, scalable browsing model for cloud object storage with AWS as the first real provider integration.

Current emphasis:

- connection management
- structural navigation
- central content listing
- storage availability awareness
- AWS-specific archival restore workflows
- local cache foundations

## Near-Term Priorities

- central listing of immediate folders and files
- incremental listing continuation with `Carregar mais`
- simple local filtering in sidebar and main content area
- simple monitored multi-file upload to the currently open AWS bucket folder
- advanced search entry point with provider-aware behavior
- continued AWS integration for object listing and archival restore workflows
- Azure implementation aligned to the same product model while keeping provider-specific restore behavior separate

## Follow-Up Opportunities

- advanced upload window with richer parameters
- richer file preview capabilities
- additional providers such as Google Cloud Storage
- cache ergonomics and performance improvements

## Roadmap Notes

This roadmap is intentionally directional rather than release-based. Feature-level plans should live under `/features` when the project has enough detail to support implementation work.
