# CloudEasyFiles

> A unified desktop file explorer for AWS S3 and Azure Blob Storage.

CloudEasyFiles is a desktop application that provides a clean, intuitive interface for managing files across cloud storage providers. It is designed to reduce the complexity of working directly with provider-specific APIs and workflows, offering a consistent experience for browsing, transferring, and managing cloud files.

The project initially targets AWS S3 and Azure Blob Storage, including archival storage workflows such as AWS Glacier restores and Azure Archive tier rehydration.

## Screenshots

Screenshots will be added as the UI evolves.

![Main application window placeholder](./docs/images/screenshot-main-placeholder.png)
![File explorer placeholder](./docs/images/screenshot-explorer-placeholder.png)
![Restore workflow placeholder](./docs/images/screenshot-restore-placeholder.png)

## Features

- Connect and manage multiple AWS and Azure accounts
- Browse cloud storage through a tree-based navigation sidebar
- Explore files and folders in a central file explorer view
- Upload, download, delete, copy, and move files
- Track operations with progress bars and status indicators
- Use a unified interface across supported providers
- View clear file state indicators such as available, archived, and restoring
- Simplify archival workflows:
  - AWS S3 Glacier restore requests
  - Azure Blob Archive rehydration
- Build on an extensible architecture designed for future provider support

## Architecture Overview

CloudEasyFiles is designed as a portfolio-quality example of clean architecture applied to a real-world desktop application.

At a high level, the system is structured around a small set of clearly separated layers:

- `Frontend UI`
  - Responsible for rendering the desktop experience, navigation, dialogs, status indicators, and user interactions
- `Application / Orchestration Layer`
  - Coordinates file operations, progress reporting, provider selection, and cross-cutting workflows
- `Domain / Core Logic`
  - Defines shared models, abstractions, and business rules independent of any specific cloud provider
- `Provider Adapters`
  - Encapsulate AWS and Azure implementation details behind stable interfaces
- `Infrastructure`
  - Handles HTTP, SDK integrations, serialization, local persistence, and platform-specific concerns

### Architectural Goals

- Strong separation of concerns
- Provider-specific behavior isolated behind interfaces
- Centralized orchestration for file operations and long-running workflows
- Reusable core logic for status handling, progress updates, and UI synchronization
- Extensible design for onboarding additional providers in the future
- Maintainable codebase suitable for production and portfolio presentation

## Tech Stack

### Desktop Application

- **Framework:** Tauri
- **Backend:** Rust
- **Frontend:** HTML, CSS, and JavaScript
- **Optional UI Layer:** React or Vue

### Core Libraries

- **Async runtime:** Tokio
- **Serialization:** Serde
- **HTTP client:** Reqwest

### Cloud Integrations

- **AWS:** AWS SDK for Rust (S3)
- **Azure:** Azure SDK for Rust (Blob Storage)

## Installation

Installation instructions will be expanded as the initial project structure is finalized.

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/)
- Node.js package manager if the frontend uses a framework or build tooling
- Valid AWS and/or Azure credentials for connected accounts

### Planned Setup Flow

```bash
# clone the repository
git clone https://github.com/your-username/cloudeasyfiles.git

# enter the project directory
cd cloudeasyfiles

# install frontend dependencies
# npm install

# run the desktop application
# npm run tauri dev
```

> Note: Exact setup commands may change once the project scaffolding is committed.

## Usage

CloudEasyFiles is intended to feel familiar to anyone who has used a database explorer or file management tool.

Typical workflow:

1. Launch the application
2. Add one or more AWS or Azure accounts
3. Select a storage account, bucket, or container from the navigation tree
4. Browse files in the explorer panel
5. Perform file operations such as upload, download, copy, move, or delete
6. Monitor operation progress and file state changes in the UI
7. Trigger restore or rehydration workflows for archived content when needed

### Supported Storage Workflows

- Standard object browsing and file operations
- Archived object visibility and status reporting
- AWS Glacier restore request flow
- Azure Archive tier rehydration flow

## Roadmap

- Initial Tauri application scaffolding
- AWS S3 integration with multi-account support
- Azure Blob Storage integration with multi-account support
- Unified provider abstraction layer
- File upload and download workflows
- Copy, move, and delete operations
- Progress tracking and background task handling
- Archived file restore and rehydration UX
- Search, filtering, and sorting
- Metadata inspection panel
- Credential management improvements
- Local caching and performance optimization
- Support for additional providers in future releases

## Contributing

Contributions are welcome.

If you would like to contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commits
4. Add or update tests where applicable
5. Open a pull request with a concise description of the change

Please aim to keep contributions aligned with the project's architectural goals:

- Maintain clear separation of concerns
- Avoid leaking provider-specific logic into shared layers
- Prefer small, focused, reviewable changes
- Keep documentation up to date

## License

This project is licensed under the MIT License.

See the [LICENSE](./LICENSE) file for details.
