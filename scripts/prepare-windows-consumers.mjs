import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyVueRuntime } from './lib/vue-runtime.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const [output] = process.argv.slice(2);
assert(
  output,
  'Usage: pnpm run check:windows-consumers <new output directory>',
);
const matrix = resolve(output);
mkdirSync(matrix);
const tarballs = join(matrix, 'tarballs');
mkdirSync(tarballs);
const pnpm = process.env.npm_execpath;
assert(pnpm, 'Run this builder through pnpm run');
const nodeDirectory = dirname(process.execPath);
const npm = [
  join(nodeDirectory, 'node_modules/npm/bin/npm-cli.js'),
  resolve(nodeDirectory, '../lib/node_modules/npm/bin/npm-cli.js'),
].find(existsSync);
assert(npm, 'The Node installation must include npm');
function run(command, args, cwd = repository) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, npm_config_workspace_concurrency: '1' },
  });
}
function runPnpm(args, cwd = repository) {
  if (/\.[cm]?js$/i.test(pnpm)) run(process.execPath, [pnpm, ...args], cwd);
  else run(pnpm, args, cwd);
}
function manifest(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}
function moduleVersion(name, directory = repository) {
  const require = createRequire(join(directory, 'package.json'));
  return manifest(require.resolve(`${name}/package.json`)).version;
}
function pack(directory) {
  const { name, version } = manifest(join(directory, 'package.json'));
  runPnpm(['pack', '--pack-destination', tarballs], directory);
  const archive = join(
    tarballs,
    `${name.replace('@', '').replace('/', '-')}-${version}.tgz`,
  );
  assert(existsSync(archive), `Missing current tarball for ${name}`);
  return [name, `file:${archive}`];
}
const shared = Object.fromEntries(
  ['core/engine', 'core/components', 'core/css-parser'].map(directory =>
    pack(join(repository, directory)),
  ),
);
const supported = ['react', 'svelte', 'vue', 'solid', 'angular'];
const frameworks =
  process.env.SYMBIOTE_CONSUMER_FRAMEWORKS?.split(',') ?? supported;
assert(
  frameworks.length > 0 && frameworks.every(name => supported.includes(name)),
  'Unknown Windows consumer framework',
);
for (const framework of frameworks) {
  const app = join(matrix, framework);
  mkdirSync(app);
  const dependencies = {
    ...shared,
    ...Object.fromEntries([pack(join(repository, 'adapters', framework))]),
    react: '19.2.3',
    'react-native': '0.85.3',
    'react-native-windows': '0.85.0',
    '@react-native/virtualized-lists': '0.85.3',
    '@react-native-community/cli': '20.1.0',
    '@react-native/community-cli-plugin': '0.85.3',
    '@react-native/babel-preset': '0.85.3',
    '@react-native/metro-config': '0.85.3',
    '@react-native/metro-babel-transformer': '0.85.3',
    '@react-native/typescript-config': '0.85.3',
    '@types/react': '19.2.0',
    '@types/node': moduleVersion(
      '@types/node',
      join(repository, 'adapters/react'),
    ),
    typescript: moduleVersion('typescript'),
  };
  if (framework === 'vue')
    dependencies.vue = moduleVersion('vue', join(repository, 'adapters/vue'));
  if (framework === 'svelte') dependencies.svelte = moduleVersion('svelte');
  if (framework === 'solid')
    dependencies['solid-js'] = moduleVersion(
      'solid-js',
      join(repository, 'adapters/solid'),
    );
  if (framework === 'angular') {
    const angularVersion = moduleVersion(
      '@angular/core',
      join(repository, 'adapters/angular'),
    );
    for (const name of ['core', 'common', 'forms', 'compiler', 'compiler-cli'])
      dependencies[`@angular/${name}`] = angularVersion;
    const example = manifest(join(repository, 'examples/angular/package.json'));
    dependencies.rxjs = example.dependencies.rxjs;
    dependencies['@babel/plugin-transform-class-static-block'] =
      example.devDependencies['@babel/plugin-transform-class-static-block'];
  }
  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify(
      {
        name: `windows-${framework}-consumer`,
        version: '0.0.0',
        private: true,
        dependencies,
      },
      null,
      2,
    ) + '\n',
  );
  cpSync(join(repository, `core/engine/windows/tests/apps/${framework}`), app, {
    recursive: true,
  });
  for (const name of ['common.js', 'common.d.ts'])
    copyFileSync(
      join(repository, 'core/engine/windows/tests/apps', name),
      join(app, name),
    );
  const babel =
    framework === 'solid'
      ? {
          presets: [
            'module:@react-native/babel-preset',
            '@symbiote-native/solid/babel-preset',
          ],
        }
      : framework === 'angular'
        ? {
            presets: ['module:@react-native/babel-preset'],
            plugins: [
              '@babel/plugin-transform-class-static-block',
              '@symbiote-native/angular/babel-register-composed',
              '@symbiote-native/angular/babel-linker',
            ],
          }
        : { presets: ['module:@react-native/babel-preset'] };
  writeFileSync(
    join(app, 'babel.config.cjs'),
    `module.exports = ${JSON.stringify(babel, null, 2)};\n`,
  );
  if (framework === 'svelte') {
    copyFileSync(
      join(repository, 'examples/svelte/metro.config.js'),
      join(app, 'metro.adapter.cjs'),
    );
    writeFileSync(
      join(app, 'metro.config.cjs'),
      `const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const native = getDefaultConfig(__dirname);
const adapter = require('./metro.adapter.cjs');
module.exports = mergeConfig(adapter, {maxWorkers: 1, resolver: {
  resolveRequest(context, name, platform) {
    const resolveNative = native.resolver.resolveRequest || context.resolveRequest;
    return resolveNative({...context, resolveRequest: (_, specifier, target) => adapter.resolver.resolveRequest(context, specifier, target)}, name, platform);
  },
}});
`,
    );
  } else
    writeFileSync(
      join(app, 'metro.config.cjs'),
      `const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');\nmodule.exports = mergeConfig(getDefaultConfig(__dirname), {maxWorkers: 1});\n`,
    );
  // JS-only fixtures expose the SDK platform without requiring a native project on the bundling machine.
  writeFileSync(
    join(app, 'react-native.config.cjs'),
    `module.exports = {platforms: {windows: {npmPackageName: 'react-native-windows', projectConfig: () => null, dependencyConfig: () => null}}};\n`,
  );
  run(
    process.execPath,
    [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund'],
    app,
  );
  const require = createRequire(join(app, 'package.json'));
  const installedReactNative = require.resolve('react-native/package.json');
  const listOwner = createRequire(installedReactNative).resolve(
    '@react-native/virtualized-lists/package.json',
  );
  assert.equal(
    moduleVersion('@react-native/metro-babel-transformer', app),
    '0.85.3',
  );
  const css = createRequire(require.resolve('@symbiote-native/css-parser'));
  assert.equal(
    css.resolve('@react-native/metro-babel-transformer'),
    require.resolve('@react-native/metro-babel-transformer'),
    'CSS and the app must share the host transformer',
  );
  assert.equal(moduleVersion('react-native', app), '0.85.3');
  assert.equal(moduleVersion('@react-native/virtualized-lists', app), '0.85.3');
  assert.equal(
    require.resolve('@react-native/virtualized-lists/package.json'),
    listOwner,
    'The app and native host must share list helpers',
  );
  if (framework === 'angular') {
    const compiler = require.resolve('@angular/compiler-cli/package.json');
    run(
      process.execPath,
      [
        join(dirname(compiler), manifest(compiler).bin.ngc),
        '-p',
        'tsconfig.angular.json',
      ],
      app,
    );
  }
  run(
    process.execPath,
    [
      join(dirname(installedReactNative), 'cli.js'),
      'bundle',
      '--entry-file',
      'index.js',
      '--platform',
      'windows',
      '--dev',
      'false',
      '--bundle-output',
      join(app, 'index.windows.bundle'),
      '--sourcemap-output',
      join(app, 'index.windows.map'),
      '--max-workers',
      '1',
    ],
    app,
  );
  const sources = manifest(join(app, 'index.windows.map')).sources;
  assert(
    sources.some(path =>
      path
        .replaceAll('\\', '/')
        .endsWith('@symbiote-native/engine/build/platform/index.windows.js'),
    ),
    'Metro must select the native Windows platform',
  );
  assert(
    sources.some(path =>
      path
        .replaceAll('\\', '/')
        .endsWith(
          '@symbiote-native/components/build/component-names/index.windows.js',
        ),
    ),
    'Metro must select the Windows native component names',
  );
  if (framework === 'vue') verifyVueRuntime(sources);
  console.log(`Packed Windows consumer ready: ${framework}`);
}
