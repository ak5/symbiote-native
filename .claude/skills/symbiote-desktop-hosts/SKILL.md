---
name: symbiote-desktop-hosts
description: Native desktop integration boundaries and verification for the ak5 fork.
---

# Desktop hosts

Work stays in `ak5/symbiote-native`. Do not open PRs, issues or comments in the original project without explicit new approval.
Keep macOS, Windows and Linux work on `feat/catalyst`, `feat/windows` and `feat/linux` respectively.
The shared C++ engine owns the retained tree; adapters stay thin. Do not patch React Native, Fabric or Yoga.
Use Metro for application bundles. Do not substitute Electron or Tauri.

Read the platform README and workflow on the relevant branch for current build commands.
A successful bundle does not prove native APIs are available. A compile-only check does not prove an application works.

## Shared public Fabric boundary

`SYMBIOTE_PUBLIC_FABRIC` selects the JSI-only boundary in the existing `SymbioteTree.cpp`.
Retained nodes, mutation decoding, tag rules, dirty propagation, prop diffs and handle ownership stay shared.
`SymbiotePublicFabric.h` holds a per-call runtime/binding pair, without a second tree or a global runtime cache.
Opaque Fabric objects cross the SDK boundary without casting host objects or extracting private runtime pointers.

The public backend clones changed child sets and appends children through published Fabric methods.
It cannot inspect Fabric's landed clones, so it does not use the direct backend's targeted replacement optimization.
Interactive instance handles remain weak; raw text still needs an object handle for public `createNode`.
Measurements and commands use public methods; bounding rectangles convert Fabric's tuple to the engine's object shape.
`readSurfaceTelemetry` is absent, and `probeUIManager` throws an unsupported diagnostic instead of inventing telemetry.

Both public and direct backends passed 317 real Fabric C++ tests, including 300 mutation programs.
The public backend also passed 26 existing framework checks under Hermes.
Use `-DSYMBIOTE_PUBLIC_FABRIC=ON` with the existing C++ harness and `SYMBIOTE_ITEST_BUILD=build-public` for its JS runner.
Pass integration-test files individually to keep execution sequential. React reorder fails identically on both backends under JSC; use Hermes.

## Windows integration

The verified combination is RNW 0.85.0, React Native 0.85.3 and React 19.2.3, installed without peer overrides.
Pin virtualized-lists and the Metro Babel transformer to the app's RN version.
RN remains an explicit top-level peer. Other SDK versions and architectures need their own checks.

RNW supplies a per-DLL ABI JSI runtime, including through TurboModule CallInvokers.
Its `createArrayBuffer(MutableBuffer)` path is unsupported; `SymbioteBuffer.h` allocates through the runtime's Int32Array constructor.
Do not add npm JSI headers alongside SDK JSI headers or reach into private Fabric/Folly headers to recover a raw Hermes runtime.

`windows/SymbioteEngineModule.h` registers through the SDK's C++ TurboModule API.
The synchronous version lookup installs bindings once per runtime; module instances can be recreated.
Failed initialization must propagate before the JS resolver caches an engine.
The production WinRT provider and `react-native.config.cjs` integrate with the official Windows autolinker.

`windows/SymbioteEngine.props` is shared by the production library and SDK fixture configurator.
It compiles the shared engine plus the app's unchanged RN `JSIDynamic.cpp`, exposing only its conversion header.
Folly comes from the pinned vcpkg manifest with `x64-windows-static-md` to preserve the SDK DLL CRT contract.
Use a short buildtrees root such as `C:/tbz-b` to keep generated object paths below Windows limits.
Save partial dependency caches even after failure; use per-run keys with dependency-hash restore prefixes.

The application gate installs packed packages normally, autolinks the actual provider and builds a bundled Win32 SDK app.
Its native module/ABI smoke checks shared buffers, NativeState and actual Fabric commits and measurements at 120 then 240 pixels.
`scripts/prepare-windows-consumers.mjs` supplies normal installed React, Svelte, Vue, Solid and Angular apps, including Angular AOT.
The standard CLI still generates mobile hosts; use the SDK application procedure in `core/engine/windows/README.md` for Windows.

TextInput uses the stock `WindowsTextInput` descriptor and SDK direct-event declarations.
SafeAreaView maps to View; InputAccessoryView drops its whole subtree, following RNW's non-iOS contract.
The stock app builder needs `SymbioteWindowMessages.h` around its blocking Start call to forward real resize notifications
through DesktopWindowBridge. Keep its UI-thread lifetime, subclass cleanup and SWP_NOSIZE filter.

Fork run `40975690998` at `4a5876ca` passed all five native framework journeys:
layout updates, UI Automation focus/typing/controlled uppercase, native Ctrl+C with a separate OS clipboard client,
external Unicode paste, real SetWindowPos resize reaching each framework's dimension hook, and OS wheel/native scroll callbacks.
The ScrollView must remain accessible with its list role/label for UIA lookup. Do not remove accessibility to make tests pass.
The runner attempts every framework, retains logs and fails if any journey fails.
This default-scale resize result does not prove HiDPI or multi-monitor correctness.

## Windows persistence gate

The fixture installs AsyncStorage 3.1.1 as an application dependency, without adding it to the engine's runtime dependencies.
Its public Windows JS API uses the autolinked RNCAsyncStorage module and SQLite backend, without React hooks.
`PersistenceConfig.h` sets its documented CoreApplication database-path property before startup for the unpackaged fixture.
Validate the environment path before passing it to the provider.

The runner launches each framework in separate write/read processes against the same private database.
The read phase cannot write; it must recover the exact Unicode snapshot and both phases must update the native framework UI.
Retain phase logs and a diagnostic SQLite copy, wait for process exit, restore the original bundle and remove only owned temporary data.
Do not replace native persistence with a JS map or direct test-side file writes.

AsyncStorage ships an obsolete CppWinRT-only packages.config alongside its modern RNW PackageReferences.
The App SDK checks that obsolete file even though restored project.assets.json already contains its complete dependency graph.
The fixture validates and removes only that redundant configuration and its None entry. Keep dependency verification enabled.
Native persistence verification is pending; inspect the exact current fork run before claiming it passes.
The text-control and AsyncStorage checks do not establish ExpoClipboard or ExpoSQLite companion support.

## Other desktop branches

Catalyst uses UIKit/Fabric, not AppKit or react-native-macos. The Svelte example owns a dedicated Catalyst entry and scheme.
Native run `39563584266` passed state/input remount, keyboard clipboard, settings persistence/relaunch, scrolling and window resizing.
See `examples/svelte/README.md` on `feat/catalyst` for native commands.

Linux uses react-native-linux `4db5e336b529c15628ffb8ba94cd6d880ff9a450` with RN 0.87.1 and the host's C++ autolinker.
Run `40975831910` on `feat/linux` passed all five native framework input, injected-resize and wheel journeys,
plus ten fresh-process storage write/read windows through the host's RNAsyncStorage SQLite backend.
Resize uses host-injected configure events under Cage; it is not a compositor-driven drag.
The host clipboard is process-local and AT-SPI is unavailable. Do not describe its automation tree as a screen-reader bridge.
Expo-backed companions need native providers and separate verification on each desktop host.
