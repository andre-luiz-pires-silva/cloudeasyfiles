# Contributing

## Overview

CloudEasyFiles is maintained as a product-style repository. Contributions should keep the codebase readable, provider behavior explicit, and documentation aligned with implementation.

## Local Setup

```bash
npm install
npm run tauri:dev
```

## Required Validation

Before opening a pull request, run:

```bash
npm run check
```

This currently validates:

- frontend TypeScript and production build
- Rust compile-time checks with `cargo check`

## Pull Request Expectations

- Keep changes scoped and well described.
- Update documentation when behavior, status, or public usage changes.
- Do not leave provider behavior ambiguous when AWS and Azure differ.
- Include manual test notes for UI or workflow changes that are not covered by automation.

## Commit and Review Guidance

- Prefer small, reviewable commits over large mixed changes.
- Use imperative commit messages.
- Call out user-visible behavior changes in the PR description.
- Highlight known tradeoffs or follow-ups instead of hiding them.

## Release Flow

The repository uses two different GitHub Actions flows:

- CI on push and pull request for validation
- tag-based release publishing for installers

To publish a new release:

1. Update the project version and changelog.
2. Merge the release-ready state to `main`.
3. Create and push a tag in the form `vX.Y.Z`.
4. Let the release workflow build Linux and Windows installers and publish them to GitHub Releases.

## Repository Structure

- `src/`: frontend application code
- `src-tauri/`: Tauri and Rust backend
- `docs/`: product, architecture, ADRs, releases
- `features/`: feature specs and implementation plans

## Documentation Rule

If a change affects:

- setup
- packaging
- supported providers
- release status
- public workflows

then update the relevant public docs in the same pull request.
