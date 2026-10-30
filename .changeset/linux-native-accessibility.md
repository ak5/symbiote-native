---
'@symbiote-native/engine': patch
---

Connect the Linux native host to AccessKit's AT-SPI transport, with immutable
scene snapshots, native focus and editing actions, and stale-action protection.
Keep this fork implementation in progress until native client and lifecycle
checks pass; no original-project submissions are included.

Add an independent AT-SPI client and packed six-component app gate on a private
D-Bus/Wayland seat, and align the native regression fixtures with the pinned SDK.

Reject queued accessibility actions after a control or ancestor becomes hidden.
Document exact companion-provider gaps and verify the native image fixture loads.

Exercise native in-process session replacement and old AT-SPI handles, and run
the real packed app under native ASan/UBSan and TSan after the normal gate.

Preserve oversized grapheme text through AccessKit Label values rather than a
label property that the platform does not use for that role.

Initialize the public adapter entry point in the accessibility fixture, and
require default native behavior registration in packed Linux consumer bundles.

Carry declared custom accessibility actions through the real AT-SPI transport
and native event handler, with stable identities, revocation and actual client checks.

Build the pinned Skia source with matching native sanitizers and RTTI so UBSan
can retain its vptr checks when linking the real window.

Investigate native lifecycle races with an instrumented, checksum-pinned lavapipe
build that retains observable synchronization and removes sanitizer exclusions.
Verify the real window loaded that exact driver during the external client gate.

Release owned C ABI action text, the Wayland activation proxy and process font
resources during shutdown, retaining the real leak-detection gate.

Use atomic access for the pinned Mesa driver's shared fence-timeout cache after
its fully instrumented native run exposed concurrent lazy initialization.
