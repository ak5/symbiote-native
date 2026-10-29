---
'@symbiote-native/vue': patch
---

Use the consuming app's Vue peer runtime for rendering, lifecycle and refs. Avoid a separately resolved runtime-core copy that loses ref ownership and reactive updates when patch versions differ.
