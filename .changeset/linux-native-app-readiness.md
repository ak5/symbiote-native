---
'@symbiote-native/engine': patch
---

Wait for the native application's first committed accessibility tree before
exercising controls. Instrumented JavaScript startup has a bounded readiness
wait; existing selection, input, modal and refresh response assertions remain.
