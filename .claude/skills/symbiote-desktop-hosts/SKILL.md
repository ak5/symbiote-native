---
name: symbiote-desktop-hosts
description: Native desktop integration boundaries and verification for the ak5 fork.
---

# Desktop hosts

Keep work in `ak5/symbiote-native`. Do not open PRs, issues or comments in the original project without explicit new approval.
Keep macOS, Windows and Linux work on their respective `feat/catalyst`, `feat/windows` and `feat/linux` branches.
The shared C++ engine remains the owner of the retained tree; adapters stay thin. Do not patch React Native or Yoga.

## Windows compatibility probe

The Windows branch is not yet an application host. Its CI compiles and links the actual shared engine
inside the released RNW SDK's standard native-library template. An exported function calls
`symbiote::installBindings`, preventing an unused engine from making the link check falsely green.
The SDK fixture is disposable and does not install `@symbiote-native/engine` with incompatible peers.
Do not weaken the engine's peer range merely to make installation succeed.

Verified source constraints on 2026-10-30:

- RNW 0.85.0 declares React Native `^0.85.0`; the fixture uses RN 0.85.3. Symbiote currently declares RN >=0.86.
- RNW supports C++ TurboModules via `AddTurboModuleProvider`; see
  [its integration test](https://github.com/microsoft/react-native-windows/blob/22f3d36d000a81ae3734a48c909a781a21a43511/vnext/Microsoft.ReactNative.IntegrationTests/JsiTurboModuleTests.cpp).
- RNW's ABI runtime still aborts in `createArrayBuffer(MutableBuffer)` in both the
  [0.85 source](https://github.com/microsoft/react-native-windows/blob/22f3d36d000a81ae3734a48c909a781a21a43511/vnext/Microsoft.ReactNative.Cxx/JSI/JsiAbiApi.cpp)
  and inspected main revision `36a4425edd1667e38e7ba5a14cefce1a034567f3`.
  The shared `allocInt32Array` now allocates via the runtime's `Int32Array` constructor instead.
  `SymbioteBuffer.h` is used by both production bindings and the native probe; the probe checks zero
  initialization, shared writes in both directions, zero length and rejection of invalid lengths.
- Symbiote calls `UIManagerBinding::getBinding` and Fabric C++ methods directly. Native module registration
  alone does not prove that these symbols link or that host objects survive the Windows ABI boundary.
- The SDK probe reached the engine compiler in fork run `40917284480`; it stopped on private Fabric/Folly
  headers. Adding include directories alone cannot establish runtime compatibility.
- At the pinned RNW revision, `Microsoft.ReactNative.Cxx/JSI/JsiApiContext.cpp` constructs a per-DLL
  `JsiAbiRuntime`, including the runtime supplied through C++ TurboModule CallInvokers. It is not the raw
  Hermes runtime. `Microsoft.ReactNative/JsiApi.cpp`'s `GetHostObject` assumes its own ABI wrapper, while
  the engine retrieves Fabric's C++ `UIManagerBinding` host object. This boundary needs a real native
  probe before any shared-tree refactor; do not bypass it with private property-bag pointer casts.

`core/engine/src/platform/index.windows.ts` follows RNW's Platform API: numeric Windows API contract
version, separate RN/RNW version metadata, dev-gated testing and Windows/native/default selection.
Its unit tests establish that JS contract only, not a functioning Windows engine or application.

The sequential `fabric-runtime` job in `windows-engine.yml` builds a stock RNW Win32 app with
`core/engine/windows/tests/FabricProbe.h`. It tests public Fabric JSI calls from the SDK's ABI runtime,
NativeState ownership and a Hermes-allocated command buffer. Fabric must create, clone, commit and
measure a view at 120 then 240 pixels wide. It includes no private Fabric headers and changes no RN
source. This is a boundary experiment, not a second retained tree or a production Windows backend.
Fork run `40928140154` passed this actual Win32 runtime gate at `395ab84c`. The direct native
engine compile still fails on private Fabric/Folly headers. A shared-tree backend using the public
JSI boundary is therefore the next integration step; the successful probe is not that backend.

Next gates: resolve compiler/linker failures without modifying RN core; prove the runtime boundary in a real
Windows host; establish a tested React Native version contract; then add Metro application targets and test
the existing adapters' keyboard, clipboard, resize, persistence, scrolling and accessibility journeys.
Do not describe a compile-only probe as Windows application support.

## Shared public Fabric backend

`SYMBIOTE_PUBLIC_FABRIC` selects a JSI-only Fabric boundary in the existing `SymbioteTree.cpp`.
The retained tree, mutation decoding, tag rules, dirty propagation, prop diffs and handle ownership
stay shared. `SymbiotePublicFabric.h` holds only a per-call runtime/binding pair; it has no retained
nodes or global runtime cache. Opaque Fabric objects cross the SDK boundary without host-object casts.

The public path clones changed child sets and appends children through Fabric's published methods.
It cannot inspect Fabric's landed clones, so it does not use the direct backend's targeted replacement
optimization. The direct path remains unchanged. Raw text still gets an object instance handle because
public `createNode` requires one, even when the node has no event handlers. Instance handles on
interactive elements remain weak, preserving the existing ownership rules.

The optional `readSurfaceTelemetry` binding is absent on this backend because public Fabric exposes
no transaction telemetry. `probeUIManager` throws an explicit unsupported diagnostic instead of
inventing a surface count. App-facing measurement, commands, responder and accessibility calls use
the corresponding public methods; bounding rectangles are converted from Fabric's tuple to the
engine's object shape.

Local verification: both public and direct backends passed all 317 real Fabric C++ tests, including
300 mutation programs. Under Hermes, 26 existing native adapter checks passed across React, Svelte,
Vue, Solid and Angular, including actual reorder frames/mount commands, repeated state updates,
controlled-input behavior and public host handles. The React reorder fixture fails identically on
both backends under JavaScriptCore; use the project's normal Hermes runtime for adapter tests.
This is not yet wired into the Windows SDK application: Folly/CSS dependencies, RN 0.85 compatibility,
module registration and actual Windows app journeys still need integration and verification.

Configure the existing harness with `-DSYMBIOTE_PUBLIC_FABRIC=ON` and build the same targets in
`core/engine/cpp/tests/build-public`. Use `SYMBIOTE_ITEST_BUILD=build-public` for `scripts/run-itests.mjs`.
Pass files individually for sequential execution; the script otherwise uses all available workers.

The Windows `native` CI job now selects `SYMBIOTE_PUBLIC_FABRIC` and consumes Folly through the
pinned vcpkg manifest in `core/engine/windows/vcpkg.json`. The static-md triplet keeps the SDK's
DLL CRT contract while avoiding a second set of dependency DLLs. Dependency builds use two workers
and a binary cache. The fixture compiles the installed RN package's unchanged `JSIDynamic.cpp` and
exposes only its conversion header in a generated include directory; it never adds npm's JSI
include directory alongside the SDK's JSI. Actual Windows compile/link verification is pending.

`windows/SymbioteEngineModule.h` is the SDK C++ TurboModule, registered under `SymbioteEngine`.
Its first synchronous `getVersion()` call installs the shared bindings; later lookups preserve them.
The JS resolver uses the same synchronous initialization path as Linux and propagates failures
before caching a result. Eight resolver regression tests pass. Module syntax is checked locally;
actual RNW registration and runtime execution still need to be added to the application gate.

The native `TreeTest.portableModuleInstallsBindingsAndPreservesThemAcrossLookups` test now exercises
the production Windows module with a real JavaScriptCore/Fabric host: it installs absent bindings,
commits a View, recreates the module and asserts binding identity is preserved. It passed locally
with the public backend. This establishes module behavior, while the actual Windows SDK build
and platform registration remain separate pending gates.

The `native` Windows gate now also builds a standard Win32 app with the actual engine and registers
`SymbioteEngineModule`. `index-engine.windows.js` initializes it, runs `engine-smoke.js` through the
production mutation buffer (create/commit/measure120→240), checks repeated module lookup preserves
bindings, then runs the existing SDK-boundary probe. Its standalone tag uses a separate range to
avoid colliding with the retained engine's allocator. The same smoke fixture passed locally under
Hermes with real Fabric. Actual Windows execution remains pending.

`scripts/configure-windows-engine.ps1` is shared by the library and application compile gates;
both consume identical engine sources, dependencies and SDK-owned JSI headers. Run40937466948
stopped before compilation because the vcpkg binary-cache setting used `files;path` instead of
`files,path`; the corrected configuration still needs its Windows build result.

The standalone SDK-only job is folded into the production-engine app gate: the same C++ boundary
assertions still run after the real engine smoke passes, using the same installed dependencies.
There is one sequential Windows job, avoiding duplicate SDK installations and a superseded probe
holding the workflow concurrency slot after a failed production build.

Save the Windows dependency binary cache immediately after successful installation, before compiling
the engine. A later engine failure must not discard completed Folly builds. The workflow uses
explicit cache restore/save steps and retains vcpkg build logs on failure.

The public-backend sources `SymbioteTree.cpp`, `SymbioteFabricProps.cpp` and
`SymbioteEngineBindings.cpp` also passed a local syntax check against the unmodified npm
`react-native@0.85.3` headers. The check reused the native harness compiler settings, replacing
only React Native include paths. This establishes source compatibility for those units; it does
not establish SDK linking, Windows runtime behavior or the full JS peer contract. Keep the peer
range unchanged until those gates pass.
