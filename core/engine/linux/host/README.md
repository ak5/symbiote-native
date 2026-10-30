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

Native compile/runtime checks for this implementation are in progress. A second
native client must verify system clipboard exchange before this capability is
reported as complete. The earlier run above proves the shortcut safeguards and
process-local clipboard journeys. AT-SPI and the other missing native controls
remain in scope. The host's MIT license is retained in `LICENSE`.
