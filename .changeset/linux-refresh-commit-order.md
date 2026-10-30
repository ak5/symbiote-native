---
'@symbiote-native/engine': patch
---

Preserve Linux refresh prop transitions through the native mount command queue.
An accepted refresh that finishes before the next frame now stops its indicator
and allows another pull. Add a native controller regression for that commit order
and retain the Hermes/Fabric controlled-handshake assertions.
