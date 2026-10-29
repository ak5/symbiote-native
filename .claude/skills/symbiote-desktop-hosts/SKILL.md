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
  Symbiote's exported `allocInt32Array` uses this operation. It is not currently called by production JS,
  but must not be exposed as working on Windows without a safe implementation and a runtime test.
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
Do not refactor the shared tree around this route until the actual native runtime gate passes.

Next gates: resolve compiler/linker failures without modifying RN core; prove the runtime boundary in a real
Windows host; establish a tested React Native version contract; then add Metro application targets and test
the existing adapters' keyboard, clipboard, resize, persistence, scrolling and accessibility journeys.
Do not describe a compile-only probe as Windows application support.
