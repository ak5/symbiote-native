// Declares the Android and Linux native projects to their platform autolinkers.
// Explicit rather than relying on auto-detection, so the Kotlin ReactPackage is registered
// deterministically — same reasoning as `packages/android/react-native.config.js`.
//
// `ios` is deliberately ABSENT rather than null: the iOS half is a real podspec
// (`symbiote-engine.podspec`) that CocoaPods autolinking already finds, and naming the key would
// only give us a chance to get it wrong.
//
// `.cjs`, not `.js`: this package is `"type": "module"`, so a `.js` file using `module.exports`
// would be loaded as ESM and throw. The CLI searches `react-native.config.js`,
// `react-native.config.cjs` and `react-native.config.ts` (cli-config's `searchPlacesForCJS`), so the
// extension costs nothing.
const path = require('node:path');

module.exports = {
  dependency: {
    platforms: {
      linux: {
        cxxModuleCMakeListsPath: path.join(__dirname, 'linux/CMakeLists.txt'),
        cxxModuleCMakeListsModuleName: 'symbiote_engine',
        cxxModuleHeaderName: 'SymbioteEngineModule',
      },
      android: {
        sourceDir: './android',
        packageImportPath:
          'import dev.symbiotenative.engine.SymbioteEnginePackage;',
        packageInstance: 'new SymbioteEnginePackage()',
      },
    },
  },
};
