---
'@symbiote-native/engine': patch
---

Save native process mappings and symbolize sanitizer crash addresses before the
runner removes its binaries. Keep native lifecycle assertions and strict
sanitizer checks enabled when collecting shutdown diagnostics.
