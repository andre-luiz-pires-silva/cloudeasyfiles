# Security Policy

## Supported State

CloudEasyFiles is an actively evolving project. Security fixes are applied to the current mainline codebase; there is no long-term support policy for older builds at this time.

## Reporting a Vulnerability

Do not open public issues for suspected security vulnerabilities.

Preferred path:

- use GitHub private vulnerability reporting if it is enabled for the repository

If private reporting is not available:

- contact the maintainer privately before public disclosure

When reporting, include:

- affected version or commit
- reproduction steps
- impact summary
- any suggested mitigation or workaround

## Scope Notes

Areas that deserve extra care in this project include:

- cloud credentials and secret storage
- local cache handling
- file-system operations
- provider request signing and transfer workflows
- packaging and desktop integration behavior
