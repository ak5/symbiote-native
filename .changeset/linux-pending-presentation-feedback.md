---
'@symbiote-native/engine': patch
---

Keep native Wayland presentation feedback owned until the compositor reports its
outcome, and release unfinished feedback when the window shuts down. Release the
independent accessibility client's event subscriptions before closing its logs,
including when a native lifecycle check fails.

Document native controls, ownership, readiness and required verification for the
pinned host, with companion-provider availability kept explicit.
