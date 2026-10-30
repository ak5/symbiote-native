---
'@symbiote-native/engine': patch
---

Compile the Linux window against the installed engine package in native consumer
checks. Require its native bridge and shared bindings in CMake compile commands
before running accessibility, input, modal, refresh and persistence journeys.
Build-time generated sources may be absent during configuration; both required
installed engine sources must already exist and be scheduled for compilation.
