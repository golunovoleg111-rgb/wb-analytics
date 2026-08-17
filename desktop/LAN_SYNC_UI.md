# LAN / Synchronization UI

The desktop build exposes a LAN panel from the existing B-JOB tools when running inside Electron.

The panel shows the device ID and journal count, starts/stops the authenticated LAN server, saves a host connection, exports the sync journal, and supports explicit push/pull of the supported local data stores.

Pull is a replacement operation. Users must make a JSON backup first.

This stage does not claim automatic conflict resolution. The persistent journal is diagnostic/synchronization infrastructure for the next stage.