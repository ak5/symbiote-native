# Windows engine

This experimental x64 target uses the released React Native Windows SDK, C++ TurboModules and the shared C++ retained tree through public Fabric JSI calls. It keeps the stock React Native, Fabric and Yoga sources unchanged.

The verified host combination is React Native Windows 0.85.0, React Native 0.85.3 and React 19.2.3. Applications must pin `@react-native/virtualized-lists` and `@react-native/metro-babel-transformer` to their React Native version. Other SDK versions and architectures need their own native compatibility check.

`react-native.config.cjs` exposes the `SymbioteNativeEngine` library and its WinRT package provider to the Windows autolinker. The provider registers `SymbioteEngineModule`; its first synchronous version call installs the engine bindings.

Install the dependencies in `vcpkg.json` with the `x64-windows-static-md` triplet. Set `VcpkgRoot` to the vcpkg checkout and `VcpkgInstalledDir` to the installation directory when building. Use a short vcpkg buildtrees path, such as `C:/tbz-b`, for Folly's generated object names. This target currently builds x64; other Windows architectures need dependency/toolchain verification.

The production project and SDK application gate import `SymbioteEngine.props`. It compiles the shared engine sources and the consuming app's unchanged `JSIDynamic.cpp`. Only its conversion header is exposed through a generated include directory; the SDK owns JSI headers.

Text inputs resolve to the SDK's `WindowsTextInput` component for both modes. The shared engine folds controlled and initial values and selects multiline from the intrinsic tag. Windows input event names are routed using the SDK's direct-event declarations. The native application gate checks each framework's input through Windows UI Automation: initial value, keyboard focus, typing, and a controlled uppercase update. This gate must pass before claiming native input support.

SafeAreaView uses the same plain View as RNW on Windows. InputAccessoryView follows RNW's iOS-only contract and omits its whole subtree. Each framework fixture uses a SafeAreaView root to exercise the Windows component map.

The keyboard gate also checks system clipboard exchange with a separate PowerShell client: native Ctrl+C must replace a fresh sentinel, and external Unicode text must paste through Ctrl+V and the framework's controlled update. This checks the native text control, not the Expo-backed clipboard companion.

The resize check changes the real Win32 window size through `SetWindowPos` and requires each framework's window-dimensions hook to update a native accessibility label. Initial zero-sized metrics are allowed while the window starts; the check waits for a positive viewport before resizing and requires an increased width afterward.

The library scaffold derives from Microsoft's React Native Windows 0.85 cpp-lib template at commit `22f3d36d000a81ae3734a48c909a781a21a43511`. Its MIT license is retained in `REACT_NATIVE_WINDOWS_LICENSE.txt`.

The scrolling gate sends OS wheel input over each application's native ScrollView.
It requires the framework's native scroll callback to report a vertical offset of
at least 200; merely creating the control cannot satisfy the assertion.

## Verification

From this branch, build and bundle the installed framework consumer matrix with:

```sh
nice -n 10 pnpm run check:windows-consumers <new-consumer-directory>
```

This builds and packs the workspace packages, then installs ordinary npm consumers
for React, Svelte, Vue, Solid and Angular. It verifies their production Metro
bundles, including Angular AOT. Bundling can run on macOS; it does not prove a
Windows native executable works.

The complete native commands are in `.github/workflows/windows-engine.yml`.
They require Windows, the Visual Studio C++ toolchain, a Windows SDK and vcpkg.
The gate creates standard SDK library/application projects, installs the packed
engine, runs the official Windows autolinker and builds the production WinRT
provider plus a bundled Win32 application. Runtime checks use a real desktop
session for UI Automation and keyboard/wheel input. Each framework runs in a
fresh application process. Logs and MSBuild binary logs are uploaded even when
a native check fails.

## Host limits

The engine target does not port Expo's native runtime or its companion modules.
Native text-control copy/paste is separate from `@symbiote-native/clipboard`,
which requires ExpoClipboard. Persistent storage and other companion APIs need
compatible Windows native providers and native verification; a successful Metro
bundle does not establish their availability. The standard CLI still scaffolds
the mobile hosts; the Windows SDK application setup above supplies this host.

## Native window metrics

The RNW 0.85 Win32 app builder needs window-message forwarding for dimension
updates. Its DeviceInfo also reports outer window bounds with a fixed scale of
one. `SymbioteWindowMessages.h` supplies an opt-in DeviceInfo provider through
the SDK's public module-registration API. It reports client pixels, the current
monitor's bounds, `GetDpiForWindow` density and the user's text scale. React
Native's own Dimensions and PixelRatio implementations remain unchanged.

Construct this helper on the window's UI thread before starting the React host
or requesting DeviceInfo. Use one helper per React host and keep it alive with
that host's native window. It updates metrics after resize, movement, DPI,
display and text-scale changes. State belongs to this application/host; the
engine does not replace DeviceInfo in applications that omit the helper.
Create a new React host when replacing its native window; DeviceInfo instances
are cached for the lifetime of a host.

In the generated application's C++ entry, after `pch.h`, include:

```cpp
#include <winrt/Microsoft.UI.Interop.h>
#include <SymbioteWindowMessages.h>
```

Add the installed engine's `windows` directory to the application's include path.
Keep the forwarder alive around the application's blocking event loop, after
obtaining `appWindow` and `settings` from the standard SDK template:

```cpp
symbiote::windows::WindowMessages windowMessages{
    winrt::Microsoft::UI::GetWindowFromWindowId(appWindow.Id()),
    settings};
reactNativeWin32App.Start();
```

The helper removes its window subclass and text-scale subscription when the
window is destroyed or its owner leaves scope. Its native module and UI-thread
snapshots share only application-owned state through the SDK's typed property
bag. Module callbacks hold weak references to avoid retaining an old runtime.

The native gate compares each framework's width, height and scale with actual
Win32 client bounds and DPI before and after OS resizing. The input driver uses
per-monitor DPI awareness for its coordinate queries and restores its previous
thread context afterward. Tests at the runner's default display scale do not
establish physical HiDPI or multi-monitor calibration.

## Persistent storage interoperability

The app fixtures install `@react-native-async-storage/async-storage` 3.1.1 through
normal npm installation and the Windows autolinker. Its Windows backend uses one
SQLite database per application; see the provider's documentation at
https://react-native-async-storage.github.io/.

The native fixture removes the provider's redundant CppWinRT-only
`packages.config`; RNW's imported targets already supply CppWinRT and the Windows
App SDK through `PackageReference`. Keeping both package formats makes the App
SDK check the obsolete configuration instead of the restored dependency graph.
The migration checks the original configuration before changing it and keeps
dependency verification enabled.

The Windows provider uses handwritten `RNCAsyncStorage` attributed methods,
registered by `AddAttributedModules`. Its project does not consume the JS-spec
codegen output, so the fixture disables that unused step for this provider.
CppWinRT still generates the WinRT provider from its IDL; native registration,
compilation and runtime storage checks remain required.

The application build passes `UseFabric=true` and `PlatformToolset=v145` to all
project references. The provider chooses Win32 or UWP globals before importing
RNW architecture defaults, so Fabric must be explicit at project evaluation.
The toolset matches the SDK application and engine on the VS 2026 runner.

The persistence gate launches every framework twice. The first process writes a
Unicode library snapshot into a fresh private database; a new process must
restore the exact snapshot. Both phases must also mount and update the native
framework UI. The runner checks the SQLite file header, preserves logs and a
database copy, and restores the application's original bundle afterward.

For the unpackaged Win32 fixture, `tests/PersistenceConfig.h` supplies the
provider's explicit database-path property from `SYMBIOTE_PERSISTENCE_DATABASE`.
The runner owns that temporary path and removes it after preserving diagnostics.
This is application-owned storage; the ExpoSQLite companion still needs its own
Windows provider.

On Windows, after preparing the consumer matrix and native executable:

```powershell
(Get-Process -Id $PID).PriorityClass = 'BelowNormal'
node scripts/run-windows-persistence-consumers.mjs <executable> <consumer-matrix> <new-output-directory>
```
