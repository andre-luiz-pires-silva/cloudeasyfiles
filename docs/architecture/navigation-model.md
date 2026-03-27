# Navigation Model

## Overview

CloudEasyFiles separates structural navigation from object browsing.

This is a deliberate product and architecture choice intended to keep the interface scalable and easier to reason about.

## Sidebar Scope

The left navigation tree is limited to higher-level structural items:

- saved connections
- buckets or containers

The tree must not render file objects.

Rationale:

- simplifies scanning and navigation
- reduces UI complexity in the sidebar
- avoids pushing object pagination concerns into the tree
- keeps structural context separate from object exploration

## Main Content Scope

The main content area is the primary place for browsing cloud objects.

When a container or virtual directory is selected, the main panel lists:

- immediate virtual subdirectories
- immediate files

Navigation happens one level at a time in the main panel.

## Virtual Directories

Virtual directories are resolved dynamically from object key prefixes.

Rules:

- no real directory objects are assumed
- intermediate prefix segments become synthetic directory entries
- only the immediate level for the current path should be listed

## Context Model

- The sidebar defines the current context.
- The main panel renders the navigable contents for that context.
- Object browsing should feel hierarchical without implying a real filesystem.

## Scalability Implications

Keeping objects out of the tree improves scalability and keeps loading, pagination, and object-set complexity concentrated in the main listing where those concerns can be handled more explicitly.
