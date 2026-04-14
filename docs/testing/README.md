# Testing Guide

## Overview

CloudEasyFiles now has a first automated test baseline focused on regression prevention and provider-safety guardrails.

Current priorities:

- protect backend logic that interacts with AWS and Azure semantics
- keep frontend contract tests around critical adapters and validation logic
- run tests in CI before code reaches `main` or release packaging

This guide is the permanent reference for how testing works in the repository and how future coverage should evolve.

Detailed planning and progress tracking for the current coverage-expansion initiative live in:

- [`coverage-expansion-plan.md`](./coverage-expansion-plan.md)
- [`coverage-expansion-progress.md`](./coverage-expansion-progress.md)

## Current Stack

### Frontend

- `Vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`
- `@vitest/coverage-v8`

### Rust

- `cargo test`
- `cargo llvm-cov`

## What Is Covered Today

### Rust

The initial backend suite focuses on high-signal helpers and provider guardrails:

- AWS listing normalization helpers
- AWS restore-tier validation
- AWS copy/tagging encoding helpers
- AWS multipart sizing rules
- AWS cache path sanitization
- Azure listing normalization helpers
- Azure folder placeholder and deduplication behavior
- Azure continuation and `hasMore` semantics
- Azure canonicalized headers/resource helpers
- Azure cache path sanitization

### Frontend

The initial frontend suite focuses on stable contracts and low-fragility logic:

- connection validation helpers
- connection persistence rollback on secret-save failure
- AWS/Azure provider read adapter mapping
- navigation guard helpers for delete, upload path, folder validation, restore/tier/download eligibility

## Commands

### Regular validation

```bash
npm run check
npm run test
```

### Coverage

```bash
npm run test:frontend:coverage
npm run test:rust:coverage
```

Generated coverage output is local-only and should not be committed.

## CI Behavior

The main CI workflow runs:

```bash
npm run check
npm run test
```

It also generates coverage reports and publishes:

- a summary in the GitHub Actions job page
- downloadable coverage artifacts for the workflow run

## Recommended Next Phases

See the dedicated coverage-expansion plan for the current phase-by-phase roadmap.

## Test Design Rules

- prefer deterministic unit tests over live provider calls
- test observable rules and operational guardrails first
- keep fixtures small and scenario-specific
- avoid broad snapshots
- isolate network, secrets, and platform APIs at the edge
- only add higher-level UI tests where they protect real regressions
