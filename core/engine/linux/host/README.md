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
persistence checks. Independent-client protocol verification remains required
before reporting system clipboard exchange as complete.

The protocol gate builds the actual backend with a small native Wayland window
and exchanges exact bytes with `wl-copy` and `wl-paste` on an isolated headless
Sway seat. It checks Unicode, transfers larger than a pipe buffer, invalid UTF-8,
stalled owners, responsive input and shutdown with a pending read. Normal,
ASan/UBSan and TSan builds run sequentially. Compositor and client logs are saved
with the workflow artifacts. It does not access the user's desktop or clipboard.

AT-SPI and the other missing native controls remain in scope. The host's MIT
license is retained in `LICENSE`.

`layout-conformance.patch` registers React Native's existing descriptor. Yoga's
own strict/compatibility behavior applies to the subtree; the wrapper creates no
native view. Its Hermes/Fabric tests check percentage sizing against a padded
parent, nested boundaries and changing the mode without replacing descendants.
Native validation of this patch remains pending.
