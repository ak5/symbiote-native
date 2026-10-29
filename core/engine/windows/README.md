# Windows engine

This experimental target uses the released React Native Windows SDK, C++ TurboModules and the shared C++ retained tree through public Fabric JSI calls. Windows compile and application runtime verification are still in progress. The candidate React Native 0.85.3 peer range is under compatibility validation. Applications must pin `@react-native/virtualized-lists` to their React Native version.

`react-native.config.cjs` exposes the `SymbioteNativeEngine` library and its WinRT package provider to the Windows autolinker. The provider registers `SymbioteEngineModule`; its first synchronous version call installs the engine bindings.

Install the dependencies in `vcpkg.json` with the `x64-windows-static-md` triplet. Set `VcpkgRoot` to the vcpkg checkout and `VcpkgInstalledDir` to the installation directory when building. Use a short vcpkg buildtrees path, such as `C:/tbz-b`, for Folly's generated object names. This target currently builds x64; other Windows architectures need dependency/toolchain verification.

The production project and SDK application gate import `SymbioteEngine.props`. It compiles the shared engine sources and the consuming app's unchanged `JSIDynamic.cpp`. Only its conversion header is exposed through a generated include directory; the SDK owns JSI headers.

Text inputs resolve to the SDK's `WindowsTextInput` component for both modes. The shared engine folds controlled and initial values and selects multiline from the intrinsic tag. Windows input event names are routed using the SDK's direct-event declarations. Native typing and focus verification remain required before claiming complete input support.

The library scaffold derives from Microsoft's React Native Windows 0.85 cpp-lib template at commit `22f3d36d000a81ae3734a48c909a781a21a43511`. Its MIT license is retained in `REACT_NATIVE_WINDOWS_LICENSE.txt`.
