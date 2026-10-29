---
'@symbiote-native/engine': patch
---

Add the Windows C++ TurboModule and initialize portable native bindings synchronously before resolving the engine. Failed initialization remains retryable.
