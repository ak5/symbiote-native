---
"@symbiote-native/engine": patch
---

Forward native Windows host resize messages through the SDK bridge so Dimensions and framework hooks can receive updates. The host adapter releases its native window subscription when the window closes.
