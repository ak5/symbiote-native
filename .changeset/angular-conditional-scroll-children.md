---
'@symbiote-native/angular': patch
---

Route embedded-view insertions through the authored scroll-view owner instead of
its internal content slot. Conditional refresh controls retain native placement
beside the content view across insertion, removal and remounting.
