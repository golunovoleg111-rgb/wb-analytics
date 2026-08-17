# B-JOB LAN synchronization

## Current behavior

- Each desktop installation gets a stable local `deviceId`.
- LAN host exposes authenticated data endpoints on the local network.
- The desktop UI can start/stop a LAN host, save a host address/key, push local data, and pull host data.
- A persistent sync journal is stored in the desktop data directory and can be exported for diagnostics/backup.

## Safety

Pulling a snapshot replaces the supported local stores. Always export a B-JOB JSON backup before pulling.

The journal is deliberately not used to silently resolve conflicting edits. Automatic conflict resolution will only be enabled after a dedicated conflict-review workflow is implemented.

## Offline principle

LAN mode does not require internet access. WB API synchronization remains a separate internet-dependent layer.
