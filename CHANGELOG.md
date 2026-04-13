# Changelog

## Unreleased

### Added

- Full Azure support across connection management, browsing, upload, download, folder creation, delete, tier changes, and archive rehydration
- Linux packaging improvements for app identity and icon integration
- Configurable explorer page size
- GitHub repository automation for CI and release artifact generation
- Contribution, security, and collaboration templates for the repository

### Changed

- Public project documentation now reflects the real multi-provider implementation state
- Repository metadata and packaging description now use provider-neutral cloud-storage language
- Linux application identifier updated to `com.alps.cloudeasyfiles`

### Known Limitations

- Repository quality gates are currently based on build validation and `cargo check`, not a broad automated test suite
- Linux release automation is the primary packaged-release path right now

## 0.1.0 - First AWS-Compatible Release

### Added

- Functional AWS connection management and bucket browsing
- Incremental object listing with folder-style navigation over S3 prefixes
- Tracked local-cache download flow and `Download As`
- AWS upload, folder creation, object delete, and recursive prefix delete flows
- AWS restore request submission for archived objects
- AWS storage-class change workflow
- Transfer tracking, cancelation, and local-cache-aware file state

### Documentation

- Release-oriented README and project status updates for the first AWS milestone
- Product roadmap updated to make Azure the next provider phase
- Provider cost and operational safety review added to the docs

### Known Limitations

- Azure was not implemented in `0.1.0`
- The current upload workflow had no local queue or explicit concurrency cap
- Packaging and release publication were still manual
