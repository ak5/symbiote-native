# Linux engine

This experimental target uses `react-native-linux/react-native-linux` at
`4db5e336b529c15628ffb8ba94cd6d880ff9a450` with its React Native 0.87.1 dependency.
`react-native.config.cjs` supplies the host's C++ autolinker configuration. The
generated module factory registers `SymbioteEngineModule`, whose synchronous
version call initializes the shared engine once per JavaScript runtime.

The target compiles the same retained tree and prop rules as Android and iOS.
React Native, Fabric and Yoga sources remain unchanged. Application bundles use
Metro and ordinary installed packages.

The fork's Linux workflow builds the host and engine, then installs and bundles
React, Svelte, Vue, Solid and Angular applications. Native checks cover module
initialization, Fabric updates, keyboard focus, controlled input, process-local
copy/paste and dimension updates. Run `40953438090` passed all five applications
and their ten input/resize journeys. Resize uses the host's injected configure
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

System clipboard exchange with other applications and accessibility journeys
remain unverified. The scroll gate also requires a passing native run. The pinned host's clipboard is explicitly
process-local. Expo-backed companion modules require their own Linux ports;
their presence in the workspace does not make their native APIs available.
