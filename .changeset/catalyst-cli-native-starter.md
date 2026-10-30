---
'@symbiote-native/cli': minor
---

Enable the shared native starter's Mac Catalyst target for all five frameworks.
Include the deployment mapping, standalone framework normalization before embedding,
and a renamed macos:build command for a Release build with one Xcode worker.

Start native windows through the scene lifecycle and verify a generated starter
launches and updates its counter in the packed Catalyst UI gate.
