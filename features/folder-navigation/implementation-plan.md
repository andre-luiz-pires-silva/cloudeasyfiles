# Implementation Plan: Folder Navigation

## Affected Areas

- sidebar navigation components
- main content context handling
- provider listing adapters
- folder normalization logic

## Proposed Changes

- keep the sidebar limited to structural nodes
- derive container-level navigation from provider listing calls
- resolve folders from normalized provider listing results
- keep path navigation logic in shared application/domain flows where possible
- normalize flat provider responses into explorer folder/file entries before driving navigation state
- ensure explicit trailing-slash folder sentinels and implicit prefix-derived folders collapse into one navigable folder

## Data / State Considerations

- selected connection
- selected container
- selected logical path
- currently visible listing for the active context

## Edge Cases

- empty containers
- keys with unusual prefix structures
- provider differences in listing APIs
- folder markers that should not become duplicate visible folders

## Testing Notes

- verify that files do not appear in the tree
- verify correct context switching between containers and paths
- verify one-level-at-a-time directory resolution
