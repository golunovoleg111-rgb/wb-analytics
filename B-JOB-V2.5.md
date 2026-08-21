# B-JOB v2.5 — Stable Baseline

## Status

This branch is the new stable baseline for continued development.

## Baseline source

- Based on the verified merge of PR #93.
- Excludes the experimental Warehouse Editor commits that were accidentally added after the stable point.
- Keeps the canonical warehouse domain, geometry, migration reader and permission boundary.

## Stability rules

1. Production boot is protected by a one-shot Safe Mode.
2. Optional FBS enhancements are loaded independently after `bjob:ready`.
3. Experimental warehouse/editor code must not be imported by the production boot.
4. A feature is replaced rather than layered with V2/V3/fix-on-fix implementations when it is rejected.
5. Roles and warehouse permissions are part of the protected baseline: picker/read-only users must never receive warehouse editing or publishing capabilities.
6. Every future PR must pass boot/runtime validation before merge.

## Next development stage

Warehouse Editor, Viewer map and warehouse geometry UI are developed as isolated changes on top of this baseline.
