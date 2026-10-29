---
'@symbiote-native/engine': patch
'@symbiote-native/components': patch
'@symbiote-native/react': patch
'@symbiote-native/svelte': patch
'@symbiote-native/vue': patch
'@symbiote-native/solid': patch
'@symbiote-native/angular': patch
'@symbiote-native/cli': patch
'@symbiote-native/css-parser': patch
---

Allow the React Native version used by the released Windows SDK. Resolve virtualized list helpers as an application peer, with generated apps pinning them to their React Native version, so out-of-tree hosts do not load another React Native release through a helper dependency.

Resolve the Metro Babel transformer from the application toolchain to avoid mixing parser plugins from different React Native versions.
