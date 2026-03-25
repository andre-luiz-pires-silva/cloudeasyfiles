# CloudEasyFiles

> A unified desktop file explorer for AWS S3 and Azure Blob Storage.

CloudEasyFiles is a desktop application that provides a clean, intuitive interface for managing files across cloud storage providers. It is designed to reduce the complexity of working directly with provider-specific APIs and workflows, offering a consistent experience for browsing, transferring, and managing cloud files with an emphasis on simplicity and ease of use.

The project initially targets AWS S3 and Azure Blob Storage, including archival storage workflows such as AWS Glacier restores and Azure Archive tier rehydration.

## Screenshots

The repository currently includes SVG placeholders that can later be replaced by real product screenshots.

![Main application window placeholder](./docs/images/screenshot-main-placeholder.svg)
![File explorer placeholder](./docs/images/screenshot-explorer-placeholder.svg)
![Restore workflow placeholder](./docs/images/screenshot-restore-placeholder.svg)

## Features

- Connect and manage multiple AWS and Azure accounts
- Save configured AWS and Azure connections in a tree-based navigation sidebar
- Browse cloud resources through a familiar interface inspired primarily by VSCode, with pgAdmin and DBeaver as secondary references
- Update the main content area based on the selected tree node, showing relevant details and contextual actions
- Explore files and folders in a central file explorer view when the selected context requires it
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
- **Frontend:** React, TypeScript, and Vite
- **Styling:** CSS

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
- [Node.js](https://nodejs.org/)
- Platform prerequisites required by [Tauri](https://tauri.app/start/prerequisites/)
- Valid AWS and/or Azure credentials once provider integrations are added

### Development Setup

```bash
# clone the repository
git clone https://github.com/andre-luiz-pires-silva/cloudeasyfiles.git

# enter the project directory
cd cloudeasyfiles

# install JavaScript dependencies
npm install

# run only the frontend in development
npm run dev

# build the frontend bundle
npm run build

# run the desktop app in development
npm run tauri dev
```

When the application starts successfully, it opens a desktop window and renders the initial greeting:

```text
Hello, CloudEasyFiles!
```

### Notes for Windows

Tauri requires the Microsoft C++ build tools and WebView2 runtime on Windows. If the app does not start, confirm the official Tauri prerequisites before troubleshooting the project itself.

## Usage

CloudEasyFiles is intended to feel familiar to anyone who has used tools such as VSCode, pgAdmin, or DBeaver, with VSCode serving as the primary reference for a simple and approachable navigation model.

Typical workflow:

1. Launch the application
2. Add one or more AWS or Azure accounts
3. Save those connections in the left navigation tree for future access
4. Select an account, bucket, container, folder, or file from the tree
5. Review the selected node details and available actions in the main panel
6. Browse files in the explorer area when the selected context exposes content navigation
7. Perform file operations such as upload, download, copy, move, or delete
8. Monitor operation progress and file state changes in the UI
9. Trigger restore or rehydration workflows for archived content when needed

### Supported Storage Workflows

- Standard object browsing and file operations
- Archived object visibility and status reporting
- AWS Glacier restore request flow
- Azure Archive tier rehydration flow

## Project Structure

```text
cloudeasyfiles/
|-- docs/
|   `-- images/
|-- src/
|   |-- app/
|   |-- lib/
|   |   |-- i18n/
|   |   `-- tauri/
|   |-- locales/
|   |-- index.html
|   |-- main.tsx
|   `-- styles.css
|-- src-tauri/
|   |-- capabilities/
|   |   `-- default.json
|   |-- src/
|   |   |-- app/
|   |   |-- application/
|   |   |-- domain/
|   |   |-- presentation/
|   |   |-- lib.rs
|   |   `-- main.rs
|   |-- Cargo.toml
|   |-- build.rs
|   `-- tauri.conf.json
|-- package.json
|-- tsconfig.json
|-- tsconfig.node.json
|-- vite.config.ts
`-- README.md
```

### What each part does

- `src/`
  - Contains the desktop UI built with React, TypeScript, and Vite
- `src/app/`
  - Defines the root application component and top-level providers
- `src/lib/i18n/`
  - Holds the lightweight localization provider and hook
- `src/lib/tauri/`
  - Encapsulates Tauri command calls used by the frontend
- `src/locales/`
  - Stores translation catalogs for supported languages
- `src/index.html`
  - Defines the Vite entry document and root mount node
- `src/main.tsx`
  - Boots the React application
- `src/styles.css`
  - Provides the initial visual design for the app shell
- `src-tauri/src/app/`
  - Bootstraps the Tauri application and wires the main runtime together
- `src-tauri/src/application/`
  - Holds use-case and orchestration logic that coordinates the app behavior
- `src-tauri/src/domain/`
  - Stores core business concepts that should stay independent from UI and provider details
- `src-tauri/src/presentation/`
  - Exposes Tauri commands used by the frontend
- `src-tauri/tauri.conf.json`
  - Defines the desktop window and Tauri application configuration
- `src-tauri/capabilities/default.json`
  - Declares the permissions available to the main window
- `package.json`
  - Manages frontend dependencies and development scripts
- `vite.config.ts`
  - Configures the Vite dev server and production build output
- `tsconfig.json`
  - Defines the main TypeScript compiler options for the frontend

## Frontend Architecture

The frontend currently follows a deliberately simple structure:

- `app` for root composition
- `lib/i18n` for localization
- `lib/tauri` for desktop command integration
- `locales` for translation catalogs

The project intentionally avoids extra frontend libraries for routing, global state, forms, or data fetching until those needs become concrete. React hooks and a small provider layer are the default approach.

## Roadmap

- Initial Tauri application scaffolding
- Initial greeting flow between frontend and Rust backend
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
