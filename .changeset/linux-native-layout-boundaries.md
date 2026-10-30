---
'@symbiote-native/engine': patch
---

Register React Native's actual LayoutConformance descriptor in the pinned Linux
host. Verify strict and compatibility layout, nested boundaries and live mode
changes through Hermes and Fabric without replacing Yoga or adding a native view.

Invalidate layout when a mode-only clone changes the existing subtree's rules.
