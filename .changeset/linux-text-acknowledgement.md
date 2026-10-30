---
'@symbiote-native/engine': patch
---

Keep Linux native editor text when a delayed authored value has not acknowledged
its latest edit. Reconcile against the authored props event count rather than the
native state count, and retry the value when its acknowledgement arrives.
Add native regressions for stale state and unchanged uncontrolled text.
