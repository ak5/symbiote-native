---
'@symbiote-native/components': patch
'@symbiote-native/engine': patch
---

Match React Native Windows for SafeAreaView and InputAccessoryView: render a plain View for the non-iOS safe-area wrapper and omit the iOS-only keyboard accessory subtree.
