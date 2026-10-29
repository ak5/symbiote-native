---
'@symbiote-native/engine': patch
---

Allocate shared Int32Array storage through the JavaScript runtime so it also works across the Windows SDK ABI. Reject non-finite lengths before allocation.
