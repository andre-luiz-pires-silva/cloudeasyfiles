# ADR-006: Provider-Specific Restore with No Local History

## Status
Accepted

## Context

CloudEasyFiles needs to support archival restore workflows across AWS S3 Glacier classes and Azure Blob Storage Archive.

Earlier documentation leaned toward a more generic restore entry point and polling-driven monitoring model. That direction is no longer accurate enough.

Restore behavior differs materially across providers:

- AWS uses restore tiers such as `Expedited`, `Standard`, and `Bulk`
- restore availability is temporary and tied to retention days
- AWS restore activity is inferred from object metadata rather than a global restore-jobs API
- Azure rehydration has different options and semantics

The product also does not need a permanent restore history. Keeping local restore records would create a second source of truth that can drift from provider state.

## Decision

CloudEasyFiles will treat restore as a provider-specific workflow rather than a generic cross-provider feature implementation.

For the AWS path:

- the restore UI is AWS-specific
- active restore state is derived from AWS provider metadata
- active restores are rediscovered on connection initialization, screen open, navigation, and explicit refresh
- the app does not persist restore history locally
- completed restores disappear from the active restore list once AWS no longer reports them as in progress
- the app does not rely on continuous automatic polling for restore monitoring

For the Azure path:

- the rehydration UI is Azure-specific
- Azure archive recovery is handled as an in-place tier change to `Hot`, `Cool`, or `Cold`
- active rehydration state is derived from Azure provider metadata
- the app does not persist rehydration history locally
- the app does not rely on continuous automatic polling for rehydration monitoring

## Alternatives Considered

- Generic restore modal shared by all providers
- Local persisted restore history with app-owned status tracking
- Continuous background polling while restores are active

## Consequences

- The restore UX can be transparent about AWS costs, timing, and temporary availability.
- Azure support remains free to use a different restore or rehydration workflow than AWS, and now does so explicitly.
- The system avoids stale local restore records that disagree with provider truth.
- Users get visibility into in-progress restores without the product becoming a long-term job tracker.
- Provider adapters must expose enough metadata to determine archived, restoring, and temporarily restored states.
