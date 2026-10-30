# Linux engine

This experimental target uses `react-native-linux/react-native-linux` at
`4db5e336b529c15628ffb8ba94cd6d880ff9a450` with its React Native 0.87.1 dependency.
`react-native.config.cjs` supplies the host's C++ autolinker configuration. The
generated module factory registers `SymbioteEngineModule`, whose synchronous
version call initializes the shared engine once per JavaScript runtime.

The target compiles the same retained tree and prop rules as Android and iOS.
React Native, Fabric and Yoga sources remain unchanged. Application bundles use
Metro and ordinary installed packages.

Apply the [pinned native host changes](./host/README.md) before configuring the
host. CI checks the exact host revision and applies the same patch.

The Linux component map follows React Native's non-iOS wrappers: SafeAreaView
renders a plain View, and InputAccessoryView omits its whole subtree. Each
framework fixture uses a SafeAreaView root; the bundle gate requires the Linux
component map as well as the Linux Platform module.

The fork's Linux workflow builds the host and engine, then installs and bundles
React, Svelte, Vue, Solid and Angular applications. Native checks cover module
initialization, Fabric updates, keyboard focus, controlled input, process-local
copy/paste and dimension updates. Resize uses the host's injected configure
events under Cage.

The scroll gate adds a forty-row ScrollView to each application and injects wheel
input inside its viewport. It requires the native scroll event to report at least
200 pixels of vertical movement; startup alone cannot satisfy the assertion.

The persistence gate launches each bundled application twice with the same
isolated data directory. It writes a library through the host's `RNAsyncStorage`
module, exits, then verifies the library in a new native process. Logs and window
screenshots are saved under the host's `build/e2e/persistence` directory. This
checks the host's native key-value API; it does not provide `ExpoSQLite` or
establish support for the Symbiote SQLite companion.

For a configured host checkout and prepared consumer matrix, run sequentially:

```sh
nice -n 10 node scripts/run-linux-window-consumers.mjs <host> <consumer-matrix>
nice -n 10 node scripts/run-linux-persistence-consumers.mjs <host> <consumer-matrix>
```

The complete dependency, build, autolinking and bundle commands are maintained
in `.github/workflows/linux-engine.yml`. Native window checks require Linux,
Cage, Lavapipe and the host's compiled `rnl_window` and `rnl_inject` executables.
The persistence runner reuses the pinned host's compositor launcher and refuses
to overwrite an earlier result directory.

## Host limits

The pinned host registers native view, text, image, scroll, text-input, switch
and activity-indicator descriptors. It does not register `ModalHostView`,
`PullToRefreshView` or `LayoutConformance`. Their shared component exports do
not supply Linux native implementations. Preserve the host's unknown-component
diagnostics; replacing these controls with an ordinary View would lose their
behavior.

The pinned host's clipboard starts as process-local storage. The host patch adds
a Wayland data-device backend; its native checks and second-client exchange
verification must pass before claiming system clipboard support. The host still
has no AT-SPI bridge. Its automation tree and injected input checks do not
establish screen-reader interoperability.
Expo-backed companion modules require their own Linux ports; their presence in
the workspace does not make their native APIs available.
