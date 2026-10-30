---
'@symbiote-native/engine': patch
---

Add pinned Linux host clipboard guards and native regression checks before
system clipboard integration. Secure fields cannot export their contents;
empty copy, cut and paste preserve existing data.
