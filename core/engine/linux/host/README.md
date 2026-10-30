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
```

`clipboard-safety.patch` prevents secure text from entering the clipboard,
preserves text and clipboard contents when copy/cut has no selection, and
preserves a selection when pasting empty clipboard text. Read-only text can be
copied without deletion. The patch also adds native controller regression tests
to the host's existing Hermes test target; CI builds it and runs the controller
suite before application checks.
Fork run `41002818528` passed all 21 native controller tests and the five-framework
application and persistence matrix.

`system-clipboard.patch` installs a Wayland data-device backend on the window's
connection and seat. It dispatches clipboard proxies on a private worker queue.
Writes require focus, an input press serial and compositor acknowledgement;
reads validate complete UTF-8. Frame-thread editing polls pending results, and
JavaScript promises settle on the JS thread. Late results cannot overwrite an
intervening edit. The worker stops before its connection or seat is destroyed.
The patch includes its threading decision in the host's ADR-0004.

Fork run `41012824604` compiled this implementation and passed all 36 isolated
native clipboard/controller cases, the five-framework window matrix and native
persistence checks. Run `41016615907` also passed independent-client clipboard
exchange in normal, ASan/UBSan and TSan builds, followed by the full native
application matrix. Its saved protocol logs verify all six cases in each build.

The protocol gate builds the actual backend with a small native Wayland window
and exchanges exact bytes with `wl-copy` and `wl-paste` on an isolated headless
Sway seat. It checks Unicode, transfers larger than a pipe buffer, invalid UTF-8,
stalled owners, responsive input and shutdown with a pending read. Normal,
ASan/UBSan and TSan builds run sequentially. Compositor and client logs are saved
with the workflow artifacts. It does not access the user's desktop or clipboard.

AT-SPI and the other missing native controls remain in scope. The host's MIT
license is retained in `LICENSE`.

`layout-conformance.patch` uses React Native's existing shadow node and Yoga
strict/compatibility behavior. A small Linux descriptor invalidates layout on a
mode-only clone: RN's style comparison otherwise leaves the previous geometry
cached. It creates no native view and changes no React Native or Yoga source.
Its Hermes/Fabric tests check percentage sizing against a padded parent, nested
boundaries and changing the mode without replacing descendants. Initial and
nested modes passed in `41026127748`; the mode-change regression exposed the
invalidation issue. Run `41026955352` passed all 39 native cases, all 18 independent-client
clipboard cases, all five framework window journeys and native persistence.

`accessibility.patch` is an implementation in progress. It maps the native scene
to AccessKit's pinned C ABI and real Unix AT-SPI transport, and routes focus,
activation, text replacement and selection through native controllers. Worker
callbacks use immutable publications and a bounded queue; late callbacks cannot
retain a destroyed session. Programmatic text changes revoke old edits even
when React event counts do not change. Its ADR-0005 records the dependency and
threading contracts. Window builds require Rust 1.87 or newer and fetch the
pinned AccessKit/Corrosion dependencies. Native compilation and an independent
AT-SPI client are required before this can be described as verified accessibility.

The independent client runs the real packed React application in headless Sway
and a new private D-Bus session. It checks all six core components, Unicode,
geometry, hidden/protected text, focus/caret events, native text and selection
edits, Pressable activation and session removal/recreation. The client requires
AT-SPI's GI bindings; it never attaches to the operator's desktop or session bus.
Run `41054419345` passed both client cycles, 107 native regressions, all fifteen
five-framework window journeys and ten fresh-process persistence phases.
Lifecycle sanitizer checks remain incomplete.

The lifecycle client also requests a real in-process DevSettings reload, sends
old-handle edits across the reload boundary, and verifies a new adapter and
fresh editable state in the same process. The workflow replays the packed app
against native ASan/UBSan and TSan builds after the normal job succeeds. These
builds use the host's existing sanitizer presets, at most two compiler workers
and sequential matrix jobs. They enable halt-on-error and leak detection without
suppressions. The release Skia archive lacks RTTI, which prevents linking the
host's UBSan vptr checks. `scripts/build-linux-skia.py` expands the exact locked
Skia checkout, reuses its pinned dependency parser and builds the five existing
archives with RTTI and matching sanitizers. Dependency checkouts and compilation
run sequentially with at most two compiler workers. GN's effective flags are
checked before building; no sanitizer checks are disabled. Rust's dependency is
not instrumented by these C++ sanitizers. The first TSan run also reported a
mutex lifetime race inside the system lavapipe driver during device creation;
its diagnostics need investigation. Passing lifecycle/sanitizer logs are still
required before claiming this gate complete.

The TSan follow-up builds Mesa 25.2.8 from its official checksum-pinned archive,
using its sanitizer-visible synchronization mode. [mesa-tsan.patch](mesa-tsan.patch) removes
the build's default sanitizer exclusions; the driver sources retain their
licenses. Only the hash-pinned Wayland protocol wrap can supply a fallback
dependency. The resulting ICD manifest selects the generated driver for the
private test session, and the client checks the real window's process mappings.
`scripts/build-linux-lavapipe.py` applies this patch only to the downloaded Mesa source.
This build never installs into the system library directories. Its compilation
and actual TSan client run remain to be verified.

`custom-actions.patch` retains declared native action names, labels and handler
flags. Its frame owner checks the current declaration and emits React Native's
real accessibilityAction event. Opaque IDs remain stable across reordering and
are not reassigned to different names. The exact locked AT-SPI common crate is
fetched by checksum and patched to enumerate and dispatch these actions; the C
ABI manifest uses a sibling path override and its lockfile remains enforced.
Three transport regressions fail before that patch, and all ten crate tests pass
afterward. Run `41063811774` passed the native C++ and real client checks,
including reordered handlers. Clean the generated build directory after editing
dependency patches.

`lifecycle-cleanup.patch` releases resources exposed by the real native leak
gate. The C ABI's optional action payload used `MaybeUninit`, so freeing its
request did not destroy owned text. A real allocator-observation regression fails
before the cleanup and passes afterward; the host runs it through its CMake
ownership-test target. The native window also releases its Wayland activation
proxy and registers Fontconfig finalization before constructing text-pipeline
statics, so their font managers are destroyed first. Finalization belongs to the
standalone executable; embedded hosts retain control of their process lifetime.
Passing both full sanitized shutdown cycles remains required. Leak detection and
halt-on-error remain enabled.
