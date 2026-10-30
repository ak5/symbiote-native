---
name: symbiote-desktop-hosts
description: Desktop host integration boundaries and verification for the ak5 fork.
---

# Desktop hosts

Work stays in `ak5/symbiote-native`. Do not submit PRs, issues or comments to the
original project without the owner's explicit approval. Keep separate platform
branches: `feat/catalyst`, `feat/windows`, `feat/linux`.

The goal is native desktop hosts using the shared engine and existing framework
adapters. Full Linux support remains in scope: do not replace missing features
with stubs or close the goal by documenting them as absent. Changes may modify the
separate platform host, never stock React Native, Fabric or Yoga. Application
bundles use Metro. esbuild is only for the existing native integration tests.

## Linux host and SDK

The Linux host pin is `4db5e336b529c15628ffb8ba94cd6d880ff9a450` from
`react-native-linux/react-native-linux`, consuming React Native 0.87.1. Host
changes live under `core/engine/linux/host`; apply them in the documented order.
Verify autolinking against `packages/cli/src/linux-autolinking.ts` and
`autolinking-cmake.ts` in the actual host, rather than relying on its README.

`core/engine/linux` compiles the same C++ engine as Android/iOS. Its generated
factory receives a CallInvoker, not a runtime. `nativeEngine()` calls the existing
synchronous `getVersion()` before reading bindings; Linux initializes them once
per runtime. The factory can return a new module on each lookup, so an instance
boolean cannot guard live bindings. Initialization failures must propagate and
must not cache a missing engine.

The Linux Platform file reads the host's PlatformConstants before registration.
Every packed app's source map must prove automatic Linux platform/component-map
resolution and the installed adapter. React Native, React and Virtualized Lists
must resolve to the consuming app's exact SDK; do not force mismatched peers or
silently install another SDK under shared components. CSS transforms resolve
Babel through the app's React Native Metro config to keep parser versions aligned.

React Native's `componentNameByReactViewName` already translates its iOS-shaped
view, text, scroll-content and input names. Inspect it before duplicating a map.
Native props and events still need runtime checks. Global CMake C++20 is required
for the host's standalone input driver as well as the engine target.

## Native verification

Use `.github/workflows/linux-engine.yml` as the command source. It is restricted
to this fork and builds actual packed React, Svelte, Vue, Solid and Angular apps.
Vue readiness follows nextTick plus a public native measurement; retain the
native width assertion. Solid uses its shipped universal JSX preset. Angular
uses partial AOT, ngc and the native renderer at `build/angular/render/index.js`.
Keep native text styles correctly typed; do not cast away fixture errors.

Every framework needs native layout/update, keyboard, clipboard, resize,
scrolling and persistence journeys. Preserve accessible headings in Tab order;
the input driver must traverse them. Require app acknowledgement before asserting
controlled data retention, and inspect the native tree if it disagrees with app
state. A bundle or registry test alone cannot establish native behavior.

Clipboard exchange uses wl-copy/wl-paste on a private Sway seat. Require exact
bytes, focus/serial acknowledgement, responsive input during stalled transfers,
late-result rejection and shutdown with pending work. Run normal, ASan/UBSan and
TSan protocol variants. Text-control copy/paste alone does not prove exchange
with other applications.

AT-SPI uses a private D-Bus session and independent client, never the operator's
desktop. Verify actual roles, text, geometry, custom action identities, edits,
selection, notifications and in-process reload/stale handles. Modal journeys need
both cycles across all five frameworks, all animations, native pixels, real
resize, nesting, focus and data/caret retention. Refresh needs real Wayland pan
input, controlled acceptance/rejection, native indicator pixels, accessible
activation, removal, modal isolation and reload. Preserve all existing assertions.

Run controller/Hermes cases through CTest one case per process. Feature defaults
can be read by standalone controllers before ReactHost installs its overrides;
combining these suites in one GTest process breaks runtime initialization.
Keep every required case enabled and require discovery of all 39 refresh cases.

Strict native window ASan/UBSan/LSan and TSan checks include complete shutdown.
Keep halt-on-error and leak detection enabled, with no exclusions. Build pinned
Skia/Mesa with matching instrumentation rather than disabling a detector to link
or hide a report. C++ flags do not instrument Rust. Sanitizer jobs must use the pinned nightly,
rust-src, dependency-wide Rust flags, rebuilt std and the external C++ runtime.
Require actual archive instrumentation symbols, including TSan atomic operations.
Use at most two native compiler workers, one Metro worker and sequential heavy
jobs under `nice -n 10`. Do not push while a useful workflow is live: its
cancel-in-progress policy would cancel the current evidence.

## Companion and platform boundaries

The host's RNCClipboard and SQLite-backed RNAsyncStorage are different contracts
from ExpoClipboard and ExpoSQLite. ExpoSharing also requires its own provider.
The 59 companion native-link manifests do not declare Linux linkage. Keep the
provider audit accurate and test actual public companion APIs before claiming
support; never supply successful no-ops or empty providers.

Windows work stays on `feat/windows` with its separately verified RNW/RN/React
pins. Native module registration, system clipboard, client geometry/DPI, scrolling
and persistence require real Windows runs. Catalyst work stays on `feat/catalyst`
and requires the Xcode host/runtime checks. Neither platform's successful bundle
establishes unavailable companion APIs or untested architectures/hardware.

Before declaring desktop support complete, inspect current source, native CI
stdout and artifacts against every requested target and gate. Keep the full goal
active while any required behavior or native verification remains incomplete.
