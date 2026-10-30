---
'@symbiote-native/engine': patch
---

Connect the Linux native host to AccessKit's AT-SPI transport, with immutable
scene snapshots, native focus and editing actions, and stale-action protection.
Keep this fork implementation in progress until native client and lifecycle
checks pass; no original-project submissions are included.

Add an independent AT-SPI client and packed six-component app gate on a private
D-Bus/Wayland seat, and align the native regression fixtures with the pinned SDK.
