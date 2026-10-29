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

## Forward native resize notifications

The RNW 0.85 Win32 app builder resizes the Fabric surface, but its DeviceInfo
module subscribes to the separate `DesktopWindowBridge` notification channel.
Forward the host window's resize messages so the stock Dimensions singleton and
all five framework hooks receive updates. This uses the SDK's public bridge;
React Native sources stay unchanged.

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
    settings.Notifications()};
reactNativeWin32App.Start();
```

The forwarder removes its window subclass when the native window is destroyed
or its owner leaves scope. The native application gate installs this same
header and requires a real OS resize to reach every framework's metrics hook.
