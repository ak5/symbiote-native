---
name: symbiote-desktop-hosts
description: Desktop host integration boundaries and verification for the ak5 fork.
---

# Desktop hosts

Work stays in `ak5/symbiote-native`. Do not submit PRs, issues or comments to the original project without the owner's explicit approval.

Keep platform work on separate branches: `feat/catalyst`, `feat/windows`, `feat/linux`.
The goal is native desktop hosts using the shared engine and existing framework adapters.
React Native, Fabric and Yoga sources remain unchanged. Application bundles use Metro.

## Linux integration

The owner confirmed that missing Linux host features remain in scope; do not
replace them with stubs or close the goal by merely documenting them as absent.
Host changes live under `core/engine/linux/host`, against the documented host
pin. They may change this separate Linux platform host, never stock React
Native, Fabric or Yoga. Keep them in this fork; no submissions elsewhere.
Clipboard shortcut guards and native controller tests precede a real Wayland
backend and second-client verification. System clipboard, AT-SPI, modal,
refresh and layout-conformance behavior still need implementation and proof.

The experimental engine target follows `react-native-linux/react-native-linux` at
`4db5e336b529c15628ffb8ba94cd6d880ff9a450`, which consumes React Native 0.87.1.
The host's current code has Metro and C++ autolinking even though its README still describes them as planned.
Verify against its source, especially `packages/cli/src/linux-autolinking.ts` and
`packages/cli/src/autolinking-cmake.ts`.

`core/engine/linux` supplies the C++ TurboModule; its CMake target compiles the same engine sources as Android/iOS.
The generated factory receives a CallInvoker, not a runtime. `nativeEngine()` calls the existing synchronous
`getVersion()` method before reading the bindings; Linux installs them there once per runtime.
The host's module factory can produce a new module on every lookup, so an instance boolean does not protect live bindings.
Failed initialization must propagate and must not cache a missing engine.

The native engine gate passed in fork run `40911697553` at `6713de2690a9d22eeb1b1cb1289596506217b6c7`:
real C++ compile/link, initial Fabric commit, width update, and repeated module lookup without replacing bindings.

`core/engine/src/platform/index.linux.ts` reads the host's `PlatformConstants` and selects Linux
before host registration. All adapters inherit the shared `linux` selection type. Its native smoke
import is explicit; a real Metro example must still prove automatic platform-file resolution.

`.github/workflows/linux-engine.yml` is restricted to this fork. It generates registration from the
package's actual configuration, compiles the real engine and Linux host, then runs
`core/engine/linux/tests/native-smoke.ts` in Hermes. That test creates and updates a Fabric view through
the production mutation buffer. esbuild is used for this native test, as in the existing engine itests;
it is not an application bundler.

`scripts/prepare-linux-consumer.mjs <host checkout> <new directory>` builds and packs the engine,
shared components and React/Svelte adapters into separate disposable npm apps. It uses the pinned host template's
React Native version and the host's packed Metro resolver, then checks the production sourcemap
for the installed Linux Platform and adapter. Run it under `nice -n 10` with Node 24 after installing
both workspaces. The React fixture uses intrinsic tags and is type-checked before bundling. CI runs
each Metro bundle through the compiled host and verifies the mounted view's updated dimensions.
The consumer has its own explicit TypeScript project: a command-line file list can pick up the
host checkout's tsconfig and fail with TS5112 on TypeScript 6.

The window gate builds the same host with Skia/Wayland and runs both packed Metro apps through
the host's existing `scripts/e2e.ts` harness. `scripts/run-linux-window-consumers.mjs` installs
disposable scenarios, types into the adapter's controlled text input and copies/pastes through
the host's in-process clipboard. Each app must report `HiHi` and produce a window screenshot. A separate resize
scenario drives the native window from 800x600 to 1000x600; each framework's `useWindowDimensions`
must receive both sizes. All four native window scenarios passed in fork run `40936472812` at `a4c553fb`:
React and Svelte each verified keyboard focus, controlled input, in-process copy/paste and
800x600 → 1000x600 dimension-hook updates. Saved traces and screenshots confirm the assertions. Other adapters, persistence, scrolling and accessibility journeys remain to be verified.

The pinned host uses `accessible` for Tab traversal, including the heading. The input scenario
therefore tabs through the heading to the field and requires both focus markers. Run `40931012846`
confirmed this in the native screenshot: one Tab left the focus ring on the heading while key events
arrived normally. Keep the heading accessible; do not remove accessibility to make the test pass.

Run `40934052197` passed the React native input journey (heading/input focus and `HiHi`). Its
resize trace showed the full injected drag finishing before the Metro app mounted. The scenario
now holds 800x600 for five seconds using the host's 100ms configure intervals before dragging;
both hook-reported sizes remain required. This is a bounded startup allowance: a slower app still
fails instead of silently passing a resize it never observed. These are host-injected native
configure events under Cage, which cannot resize its kiosk window, not a compositor-driven drag.
The runner collects failures and attempts all framework journeys before failing the gate.

The host's input driver requires global C++20, supplied by its normal CMake preset. Our custom
build directory must set `CMAKE_CXX_STANDARD=20` too; target-specific engine settings do not reach
the standalone input driver. Compiler cache is saved after the window build to retain those objects.

The Svelte consumer composes the existing example's Metro settings with the Linux host resolver.
The shared CSS transformer resolves Babel through the app's React Native Metro config to keep parser
versions aligned. Loading the package's RN 0.86 transformer against an RN 0.87 app preset installs two
parser overrides and prevents Svelte/Vue/CSS-wrapped bundles from compiling.

React Native's `componentNameByReactViewName` already translates the iOS-shaped view, text,
scroll-content and text-input names to the Linux host's descriptors. Audit that translation before
duplicating the component-name table. Native props and events still need their own runtime checks.

This is engine bring-up, not a completed Linux application target. Before claiming Linux support:

- Pass the native compile/runtime gate and the shared engine regression suites.
- Audit the engine's non-Android assumptions against Linux component names, props and events.
- Add Metro-backed example hosts and run the same journeys across the existing adapters.
- Verify keyboard input, clipboard, resize, persistence, scrolling and accessibility on a real Linux host.
- Audit companion native packages and state any unavailable capabilities explicitly.

The pinned host's `Clipboard.h` explicitly limits copy/paste to its own process; it does not
implement Wayland clipboard exchange with other applications. The text-input journey therefore
does not prove system clipboard support, which still needs a real backend and a second-client test.

The text-input clipboard journey does not establish `@symbiote-native/clipboard` support: that
package resolves `ExpoClipboard` through `expo-modules-core`, while the pinned Linux host provides
`RNCClipboard`. Likewise, its native `RNAsyncStorage` SQLite store does not implement the
`ExpoSQLite` constructors used by `@symbiote-native/sqlite`. Neither companion is included in the
current consumer matrix; do not present their APIs as available on Linux without an actual port
and native verification.

Windows remains a separate host integration. Resolve the React Native version contract before adding
a consumer: this engine declares RN >=0.86, while the inspected published RNW stable requires RN 0.85.
Do not force mismatched peer dependencies or label an empty branch as platform support.

The Linux consumer/window matrix also includes Vue, using its ordinary `h`/`ref` lifecycle and
existing bootstrap over the same intrinsic tags. Its packed production Metro bundle and source-map
contract passed locally; the Vue native startup, keyboard and resize journeys still require CI.
The runner regression now checks all six journeys are attempted when one fails. React/Svelte's
four native journeys remain verified by run40936472812.

Solid is prepared in the same Linux consumer/window matrix. Its fixture uses the adapter's
`createWindowDimensions`, Solid signals and its shipped universal JSX Babel preset. The isolated
packed production Metro build and Linux/adapter source-map contract pass locally. The runner test
checks all eight framework journeys are attempted after a failure. Solid's actual Linux runtime
checks remain pending; do not replace the existing Vue run merely to add this fixture.

Angular completes the prepared five-adapter Linux matrix. The standalone app uses the adapter's
partial-AOT config, `ngc`, shipped Babel registration/linker plugins and normal intrinsic templates.
Its isolated packed AOT+production Metro build passed; the sourcemap must include the native AOT
renderer at `build/angular/render/index.js`. The runner regression covers all ten journeys.

That build exposed a real Angular intrinsic typing gap: `TextInputElement` inherited View-only
style inputs. It now narrows `style` and `styleProp` to the same text styles as `TextElement`.
All72 element tests pass, including strict-AOT acceptance of text colors/fonts and rejection of
invalid font-size types. The native fixture keeps its text color; it does not cast around the type.

Vue run40941029337 mounted the real app but failed its width-update assertion: the headless tree
still held120 while the app logged updated. Its marker now follows a public native-view measurement
requiring240x80 after Vue's nextTick. The original headless240 assertion remains. This strengthened
fixture bundles successfully; actual native verification is pending the next run.
