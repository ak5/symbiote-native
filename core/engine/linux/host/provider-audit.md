# Linux native provider audit

Audited the fork's companion sources and the host at
`4db5e336b529c15628ffb8ba94cd6d880ff9a450`, including the fork's host patches.
A JavaScript export or a native backend with a similar name is not evidence that
a companion's native contract is implemented.

| Consumer                     | Required native contract                                                          | Current Linux evidence                                                                                       | Work required                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Shared framework adapters    | `SymbioteEngineModule` and Fabric descriptors                                     | All five packed adapters run real native input, resize, scrolling and persistence journeys                   | Run the native gates for each supported host/toolchain revision                                                 |
| `@symbiote-native/clipboard` | `ExpoClipboard`, including its events and non-text methods                        | The host supplies `RNCClipboard`; the Wayland text backend passes independent-client exchange and sanitizers | A separate Expo-compatible provider and real companion checks; text exchange alone does not prove this contract |
| `@symbiote-native/sqlite`    | `ExpoSQLite.NativeDatabase`, `NativeStatement`, `NativeSession` and change events | The host supplies `RNAsyncStorage`, backed by SQLite; fresh-process library persistence passes               | A separate Expo-compatible provider and database/statement/session checks; key-value storage is not this API    |
| `@symbiote-native/sharing`   | `ExpoSharing` file sharing and incoming-payload operations                        | No provider is registered by the audited host/configuration                                                  | Native desktop sharing integration and real application checks                                                  |

The 59 companion `native-link.json` manifests declare Android/iOS linkage and
none declares Linux linkage. This is a source/registration audit, not a claim
that those companions were run on Linux. The current generated consumer config
registers the engine's C++ module; it does not install an Expo module runtime.
No empty provider or successful no-op is supplied to disguise a missing module.

The native provider names come from each companion's `src/core/native-module.ts`;
linkage comes from its `native-link.json`. Host providers are registered in
`packages/core/src/TurboModuleRegistry.cpp`; third-party C++ providers enter through
`globalExportedCxxTurboModuleMap()`. The integration workflow generates the actual
consumer registration from `core/engine/react-native.config.cjs`.

Keep companion support separate from the native control gates. For every added
provider, exercise the actual public companion API in a packed native application,
including persistence, failures and platform interactions where applicable.
