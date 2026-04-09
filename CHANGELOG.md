# Changelog

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

- Azure is not implemented in `0.1.0`
- Upload, restore, and storage-class change workflows are AWS-only
- The current upload workflow has no local queue or explicit concurrency cap
- Packaging and release publication remain manual
