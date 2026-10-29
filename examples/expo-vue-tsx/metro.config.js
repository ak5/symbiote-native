const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;

const defaultConfig = getDefaultConfig(projectRoot);

/**
 * @symbiote-native/* and vue resolve as ordinary npm packages from this app's
 * own node_modules (examples/* is a standalone npm install, decoupled from the monorepo's
 * pnpm workspace — see pnpm-workspace.yaml). @react-native/babel-preset strips the types.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // JSX is still compiled by @vue/babel-plugin-jsx via babel.config.js regardless of which
  // transformer runs it (unlike the SFC canary, which needs a Metro transformer to compile
  // .vue) — @symbiote-native/vue ships the standalone .css/.module.css transformer itself
  // (same framework-agnostic path the React and Angular examples use via their own adapter's
  // ./metro-css-parser export), so no local wiring file is needed here either.
  transformer: {
    babelTransformerPath:
      require.resolve('@symbiote-native/vue/metro-css-parser'),
  },
  resolver: {
    // Babel-generated helpers can resolve Vue through require conditions; share the app's ESM runtime.
    resolveRequest(context, moduleName, platform) {
      if (moduleName === 'vue') {
        return {
          type: 'sourceFile',
          filePath: require.resolve('vue/dist/vue.runtime.esm-bundler.js'),
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
    // xcodebuild leaves transient module-cache lock files in expo-modules-jsi's .DerivedData,
    // and the file watcher crashes on their readlink
    blockList: [/\/\.DerivedData\/.*/],
    // The seed database for `importDatabaseFromAssetAsync` is bundled as an asset
    assetExts: [...defaultConfig.resolver.assetExts, 'db'],
    // Teach Metro that a style file is a source file (the transformer turns it into a module).
    // scss/sass/less/styl are optional SCSS/Sass/Less/Stylus preprocessor sources — see
    // core/css-parser/src/preprocessors.ts.
    sourceExts: [
      ...defaultConfig.resolver.sourceExts,
      'css',
      'scss',
      'sass',
      'less',
      'styl',
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
