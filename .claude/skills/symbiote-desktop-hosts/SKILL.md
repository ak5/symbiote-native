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
the OS clipboard. Each app must report `HiHi` and produce a window screenshot. This gate is still
being brought up; do not claim a pass until its CI result is verified. Other adapters, persistence,
scrolling, resize and accessibility journeys remain to be verified.

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

Windows remains a separate host integration. Resolve the React Native version contract before adding
a consumer: this engine declares RN >=0.86, while the inspected published RNW stable requires RN 0.85.
Do not force mismatched peer dependencies or label an empty branch as platform support.
