---
'@symbiote-native/engine': patch
---

Add a pinned Linux host Wayland clipboard backend with validated text transfers,
input-serial authorization, compositor acknowledgement and asynchronous native
editing that preserves intervening changes.

Register native clipboard methods through RN's function-pointer metadata and
schedule asynchronous replies with the module's CallInvoker.
