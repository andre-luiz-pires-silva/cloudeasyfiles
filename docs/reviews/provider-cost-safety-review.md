# Provider Cost And Operational Safety Review

This review was performed against the current CloudEasyFiles codebase to verify that provider-side operations with cost or data-change impact only run from explicit user actions, and to identify any backend guardrails that needed strengthening.

## Scope

- Frontend orchestration in [src/features/navigation/ConnectionNavigator.tsx](/home/alps/projects/cloudeasyfiles/src/features/navigation/ConnectionNavigator.tsx)
- Tauri command surface in [src-tauri/src/presentation/commands.rs](/home/alps/projects/cloudeasyfiles/src-tauri/src/presentation/commands.rs)
- AWS service implementation in [src-tauri/src/application/services/aws_connection_service.rs](/home/alps/projects/cloudeasyfiles/src-tauri/src/application/services/aws_connection_service.rs)

## Mutating provider operations

| Operation | Trigger in UI | Provider effect | Cost / risk profile | Review result |
| --- | --- | --- | --- | --- |
| `request_aws_object_restore` | Restore modal submit | Submits S3 restore request per selected object | Retrieval request fees, temporary restored-copy storage, batch multiplication | Explicit submit only; no background polling or retry loop found |
| `change_aws_object_storage_class` | Change tier modal submit | Rewrites object into a new S3 storage class using copy or multipart copy | Request charges, retrieval implications, storage-tier cost changes | Explicit submit only; loop only completes the requested copy |
| `delete_aws_objects` | Delete confirmation submit | Deletes selected object keys | Permanent removal | Explicit submit only |
| `delete_aws_prefix` | Delete confirmation submit for folders | Lists and deletes all keys under the selected prefix | Permanent recursive removal over potentially large prefixes | Explicit submit only; pagination loop is scoped to the requested prefix |
| `create_aws_folder` | Create folder submit | Writes empty sentinel object ending with `/` | One write request | Explicit submit only |
| `start_aws_upload` / `start_aws_upload_bytes` | File picker or drag-and-drop upload flow | Uploads local file bytes to S3 | Request, transfer, storage-class-dependent costs | Explicit user selection only; no automatic queue replay found |
| `start_aws_cache_download` / `download_aws_object_to_path` | Download or Download As | Reads object from provider | Retrieval and transfer costs, especially for temporary restored/archive contexts | Explicit submit only |

## Read-only and non-mutating flows reviewed

- `connectOnStartup` in the frontend only calls `connectConnection`, which performs credential validation, bucket listing, and region resolution. It does not invoke restore, tier change, upload, delete, or folder creation.
- Navigation, refresh, filter changes, `Carregar mais`, reconnect, and content-state hydration only execute list, metadata, cache lookup, or region lookup paths.
- Restore-state visibility is rediscovered from provider metadata during listing and refresh. There is no background loop that re-submits restore requests.

## Concrete findings

### No implicit mutating provider calls found

The current frontend orchestration did not reveal any `useEffect`, startup hook, refresh path, reconnect path, or selection-change path that triggers restore, storage-class change, delete, upload, or folder creation without a direct user action.

### Strengthened restricted-bucket enforcement in backend

The review found a backend guardrail gap: several public AWS operations accepted `restricted_bucket_name` through the command input but did not consistently pass that restriction into bucket-region resolution. That meant the restriction was not being enforced uniformly across all public list/read/write entrypoints.

This review included the fix. Restricted-bucket validation is now applied consistently for:

- item listing
- restore requests
- folder creation
- object existence checks
- tracked downloads
- direct downloads
- path uploads
- byte uploads

## Review conclusions

- No current evidence was found of unrequested provider mutations being triggered by startup, refresh, navigation, reconnect, or local UI state changes.
- Batch loops exist for restore, tier change, recursive delete, multipart copy, and multipart upload, but each loop serves only to complete the exact action explicitly requested by the user.
- The main remaining operational risk is user-initiated batch execution against large selections. That risk should be managed with clear UI warnings and copy, not by assuming the app is currently auto-triggering provider work.

## Recommended follow-up

- Keep cost disclaimers generic at the product entry point and keep operation-specific warnings in restore and tier-change modals.
- Add automated integration coverage around “no mutating invoke from startup/refresh/navigation” when a test harness is introduced.
