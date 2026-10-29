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

`.github/workflows/linux-engine.yml` is restricted to this fork. It generates registration from the
package's actual configuration, compiles the real engine and Linux host, then runs
`core/engine/linux/tests/native-smoke.ts` in Hermes. That test creates and updates a Fabric view through
the production mutation buffer. esbuild is used for this native test, as in the existing engine itests;
it is not an application bundler.

This is engine bring-up, not a completed Linux application target. Before claiming Linux support:

- Pass the native compile/runtime gate and the shared engine regression suites.
- Audit the engine's non-Android assumptions against Linux component names, props and events.
- Add Metro-backed example hosts and run the same journeys across the existing adapters.
- Verify keyboard input, clipboard, resize, persistence, scrolling and accessibility on a real Linux host.
- Audit companion native packages and state any unavailable capabilities explicitly.

Windows remains a separate host integration. Resolve the React Native version contract before adding
a consumer: this engine declares RN >=0.86, while the inspected published RNW stable requires RN 0.85.
Do not force mismatched peer dependencies or label an empty branch as platform support.
