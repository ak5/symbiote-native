---
'@symbiote-native/engine': patch
---

Add a pinned Linux host Wayland clipboard backend with validated text transfers,
input-serial authorization, compositor acknowledgement and asynchronous native
editing that preserves intervening changes.

Register native clipboard methods through RN's function-pointer metadata and
schedule asynchronous replies with the module's CallInvoker.

Check the production Wayland transport against independent native clipboard
clients, including stalled transfers and sanitizer builds on an isolated seat.
