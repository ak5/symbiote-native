---
'@symbiote-native/engine': minor
'@symbiote-native/components': patch
'@symbiote-native/react': patch
'@symbiote-native/vue': patch
'@symbiote-native/solid': patch
'@symbiote-native/svelte': patch
'@symbiote-native/angular': patch
---

Implement Linux native modal presentation over stock Fabric state, with separate
paint layers, controlled close requests, fade/slide transitions, focus and input
isolation, and native accessibility projection. Retain modal content across all
five adapters until the Linux host completes its native dismissal.
