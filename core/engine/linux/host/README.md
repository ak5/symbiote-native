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
```

`clipboard-safety.patch` prevents secure text from entering the clipboard,
preserves text and clipboard contents when copy/cut has no selection, and
preserves a selection when pasting empty clipboard text. Read-only text can be
copied without deletion. The patch also adds native controller regression tests
to the host's existing Hermes test target; CI builds it and runs the controller
suite before application checks.

This patch is preparation for system clipboard exchange. The host still uses
its process-local clipboard; it does not yet exchange data with other clients.
The other missing native host features remain part of the Linux target's scope.
The host's MIT license is retained in `LICENSE`.
