const { mergeConfig } = require('@react-native/metro-config');
const {
  linuxResolverConfig,
} = require('@react-native-linux/cli/linux-resolver-config.ts');
const adapter = require('./metro.adapter.cjs');
const linux = linuxResolverConfig(__dirname);

module.exports = mergeConfig(adapter, {
  maxWorkers: 1,
  resolver: {
    ...linux,
    resolveRequest(context, name, platform) {
      // Preserve Svelte's esm-env override while applying Linux's native module overlays.
      return linux.resolveRequest(
        {
          ...context,
          resolveRequest: (_, specifier, target) =>
            adapter.resolver.resolveRequest(context, specifier, target),
        },
        name,
        platform,
      );
    },
  },
});
