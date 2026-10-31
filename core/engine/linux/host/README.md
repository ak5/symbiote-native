# Linux native host changes

These changes apply to `react-native-linux/react-native-linux` at
`4db5e336b529c15628ffb8ba94cd6d880ff9a450`. They modify that platform's own
host code, not React Native, Fabric or Yoga. Keep changes here until the owner
explicitly authorizes submissions outside `ak5/symbiote-native`.

Before configuring the pinned host, from the Symbiote repository root:

```sh
test "$(git -C <host> rev-parse HEAD)" = 4db5e336b529c15628ffb8ba94cd6d880ff9a450
git -C <host> apply --check "$PWD/core/engine/linux/host/clipboard-safety.patch"
git -C <host> apply "$PWD/core/engine/linux/host/clipboard-safety.patch"
git -C <host> apply --check "$PWD/core/engine/linux/host/system-clipboard.patch"
git -C <host> apply "$PWD/core/engine/linux/host/system-clipboard.patch"
git -C <host> apply --check "$PWD/core/engine/linux/host/layout-conformance.patch"
git -C <host> apply "$PWD/core/engine/linux/host/layout-conformance.patch"
git -C <host> apply --check "$PWD/core/engine/linux/host/accessibility.patch"
git -C <host> apply "$PWD/core/engine/linux/host/accessibility.patch"
git -C <host> apply --check "$PWD/core/engine/linux/host/custom-actions.patch"
git -C <host> apply "$PWD/core/engine/linux/host/custom-actions.patch"
git -C <host> apply --check "$PWD/core/engine/linux/host/lifecycle-cleanup.patch"
git -C <host> apply "$PWD/core/engine/linux/host/lifecycle-cleanup.patch"
git -C <host> apply --check "$PWD/core/engine/linux/host/modal.patch"
git -C <host> apply "$PWD/core/engine/linux/host/modal.patch"
git -C <host> apply --check "$PWD/core/engine/linux/host/refresh.patch"
git -C <host> apply "$PWD/core/engine/linux/host/refresh.patch"
git -C <host> apply --check "$PWD/core/engine/linux/host/selection.patch"
git -C <host> apply "$PWD/core/engine/linux/host/selection.patch"
git -C <host> apply --check "$PWD/core/engine/linux/host/input-driver-cleanup.patch"
git -C <host> apply "$PWD/core/engine/linux/host/input-driver-cleanup.patch"
git -C <host> apply --check "$PWD/core/engine/linux/host/rust-sanitizers.patch"
git -C <host> apply "$PWD/core/engine/linux/host/rust-sanitizers.patch"
```

The host's MIT license is retained in `LICENSE`. The patch series supplies these
native behaviors:

| Patch                      | Native behavior                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `clipboard-safety.patch`   | Protect secure text, empty selections, read-only cuts and empty pastes.                                |
| `system-clipboard.patch`   | Exchange real Wayland clipboard data with other applications.                                          |
| `layout-conformance.patch` | Register stock LayoutConformance and invalidate mode-only layout changes.                              |
| `accessibility.patch`      | Publish the scene through AccessKit's C ABI and Unix AT-SPI transport.                                 |
| `custom-actions.patch`     | Enumerate and route declared accessibility actions with stable identities.                             |
| `lifecycle-cleanup.patch`  | Release owned action payloads, Wayland proxies and font-cache resources.                               |
| `modal.patch`              | Present native dialogs, animate, isolate input, restore focus and preserve editor state.               |
| `refresh.patch`            | Handle native pull/release, controlled refreshing, indicator/title painting and accessible activation. |
| `selection.patch`          | Expose selectable items and checked radio selection through native accessibility.                      |

`input-driver-cleanup.patch` releases the test driver's Wayland proxies, output
bindings and XKB resources on EOF and failed startup. Refresh journeys close the
driver's input and require a successful exit, including in sanitizer builds.

## Clipboard and editor ownership

The Wayland data device uses the window's connection and seat, with a private
worker queue. Writes require focus, an input press serial and compositor
acknowledgement. Reads validate complete UTF-8. Frame-thread editing polls pending
results; JavaScript promises settle on the JS thread. Late results cannot replace
an intervening edit. The worker stops before its connection or seat is destroyed.
The host's ADR-0004 records this threading contract.

Controlled editor values are reconciled against the event count in authored
props. Native state writes advance their own count while preserving the authored
text, so their count cannot acknowledge a delayed authored value. Rejected values
are retried when actually acknowledged; unchanged props preserve uncontrolled
edits. Native controller regressions exercise both cases.

The independent clipboard gate uses a private Sway seat and `wl-copy`/`wl-paste`.
It exchanges exact Unicode and large payloads, rejects invalid UTF-8, and checks
stalled owners, responsive input and shutdown with a pending read. Normal,
ASan/UBSan and TSan variants run sequentially without accessing the operator's
clipboard or desktop.

## Layout and native controls

LayoutConformance uses React Native's existing shadow node and Yoga modes. A
Linux descriptor invalidates layout when only the mode changes. It creates no
wrapper view and changes no React Native or Yoga source. Native Hermes/Fabric
cases cover percentage sizing, nested boundaries and mode-only invalidation.

ModalHostView uses the stock descriptor and state. The frame owner sizes it,
paints it in a separate layer, routes input to the top presentation and restores
focus on dismissal. Native show/dismiss events complete fade and slide
transitions. Escape requests a controlled close and respects active composition.
All five adapters retain content until native dismissal. The active modal also
isolates the AT-SPI tree and cancels pending background refresh pulls.

PullToRefreshView uses the stock descriptor, props, event emitter and
`setNativeRefreshing` command. Smooth vertical pulls at the scroll view's top
edge show native progress and request one refresh on release. Wheel and
horizontal input retain ordinary scrolling. Rejected requests stop the indicator;
accepted and programmatic refreshing share native state. Family/emitter checks
reject stale commands. Existing activity and paragraph painters draw the indicator
and title, clipped to the scroll viewport. Focus reveals an idle control and its
focus ring; pointer, keyboard and AT-SPI activation use the native command queue.

## Accessibility and lifecycle

AccessKit worker callbacks read immutable scene publications and enqueue bounded
actions. Frame-owned controllers validate the current node, emitter, role,
visibility and permissions before dispatch. Old publications and removed sessions
cannot mutate replacements. The host's ADR-0005 records the dependency and
threading contracts. Window builds require Rust 1.87 or newer and fetch pinned
AccessKit/Corrosion sources.

Custom actions retain their declared names and labels. Opaque IDs remain stable
across reordering and are never reassigned to a different name. The locked
AT-SPI common crate is fetched by checksum and patched to enumerate and dispatch
these actions. Its C ABI manifest uses a sibling path override and its lockfile
remains enforced. Ownership and transport regressions run through CMake; clean
the generated build directory after changing dependency patches.

Selectable item roles publish explicit false as well as true states; AccessKit
uses the distinction to identify an unselected item. Checked radios publish
selected state. The independent client selects/reselects tabs and radios, rejects
a disabled tab, reads numeric ranges, requires a source-specific value-change
event, and tries an old selection handle after an in-process reload. Numeric
range publication does not establish arbitrary numeric-value setters.

The lifecycle patch releases C ABI action payload ownership and the window's
Wayland activation and unfinished presentation-feedback proxies. Completed or
discarded feedback leaves the window's ownership before its proxy is freed.
The executable purges Skia's global CPU font cache after session locals are
destroyed and before static font-manager teardown, then finalizes Fontconfig.
Embedded hosts retain control of process finalization.

## Verification

The fork's [Linux engine integration workflow](https://github.com/ak5/symbiote-native/actions/workflows/linux-engine.yml)
builds the exact pinned host with this patch series. Its normal job requires all
native controller and Hermes/Fabric regressions, independent AT-SPI lifecycle,
custom actions, selection and value events, and the five-framework keyboard,
clipboard, resize and scrolling journeys. It checks the actual CMake compile
commands for the consuming application's installed engine bridge and shared C++
bindings. The five-framework matrix also completes 30 modal animation/cycle
journeys, ten refresh journeys and ten fresh-process persistence phases.

The independent client waits for a scenario-specific committed control at startup
and after in-process reload, because the native window is published before its
JavaScript application commits. Interaction, data retention, stale-handle and
shutdown assertions remain separate from that bounded readiness wait. Event
subscriptions are released before the client's diagnostic logs close, including
when a native lifecycle check fails.

The workflow requires discovery and execution of all 39 refresh regressions in
the actual Hermes target. Five packed framework applications each run twice on
private Sway/D-Bus sessions. Refresh checks require real Wayland pan input,
acceptance/rejection, native pixels, keyboard/AT-SPI activation, draft preservation,
removal, modal isolation and in-process reload. Selection/value checks extend the
independent accessibility journey without replacing its existing assertions.

The separate full-window sanitizer jobs replay the packed React accessibility,
modal and refresh apps under ASan/UBSan/LSan and
TSan, with halt-on-error, leak detection and no suppressions. Both cycles of each
scenario must complete their native interactions, reload checks and graceful
shutdown. Standalone controller cases and Hermes cases run in separate CTest
processes so ReactHost can install feature defaults before first use. All builds
run sequentially with at most two compiler workers.

`scripts/build-linux-skia.py` builds the locked Skia archives with RTTI and
matching sanitizers; GN's effective flags are checked. `rust-sanitizers.patch`
propagates ASan/TSan instrumentation to Rust dependencies and rebuilds std with
the matching mode. The sanitizer jobs use
`nightly-2026-10-29` plus rust-src and `-Zexternal-clangrt` to share the C++ runtime.
Ordinary host builds keep their stable Rust requirement. Cargo remains locked
with two workers; Corrosion supplies an explicit target so host build scripts
and procedural macros are not instrumented. CI checks the real archive for
sanitizer references, including TSan atomic operations, before runtime tests.
See [Rust's sanitizer guidance](https://doc.rust-lang.org/unstable-book/compiler-flags/sanitizer.html#threadsanitizer)
for the need to expose all synchronization and rebuild the standard library.
TSan also uses a fully instrumented Mesa 25.2.8 driver built from its
checksum-pinned official archive.
[mesa-tsan.patch](mesa-tsan.patch) removes default sanitizer exclusions, uses
atomic access for the timeout cache and synchronizes fence completion queries
with the final signaler's mutex release. Driver sources retain their licenses;
only the hash-pinned Wayland protocol wrap may supply a fallback dependency.
Nothing is installed into system library directories. The client verifies the
selected ICD's real process mapping before running its lifecycle checks.

See [provider-audit.md](provider-audit.md) before using Expo-backed companions.
Host clipboard and key-value persistence checks do not establish ExpoClipboard,
ExpoSQLite or ExpoSharing support.
