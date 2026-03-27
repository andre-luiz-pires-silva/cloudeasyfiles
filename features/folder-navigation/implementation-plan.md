# Implementation Plan: Folder Navigation

## Affected Areas

- sidebar navigation components
- main content context handling
- provider listing adapters
- virtual directory derivation logic

## Proposed Changes

- keep the sidebar limited to structural nodes
- derive container-level navigation from provider listing calls
- resolve virtual directories dynamically from prefix-based listing results
- keep path navigation logic in shared application/domain flows where possible

## Data / State Considerations

- selected connection
- selected container
- selected logical path
- currently visible listing for the active context

## Edge Cases

- empty containers
- keys with unusual prefix structures
- provider differences in listing APIs

## Testing Notes

- verify that files do not appear in the tree
- verify correct context switching between containers and paths
- verify one-level-at-a-time directory resolution
