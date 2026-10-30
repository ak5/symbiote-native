import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { verifyVueRuntime } from './vue-runtime.mjs';

export function verifyLinuxConsumerSdk(app) {
  const consumer = createRequire(join(app, 'package.json'));
  const components = createRequire(
    join(app, 'node_modules/@symbiote-native/components/package.json'),
  );
  const native = createRequire(consumer.resolve('react-native/package.json'));
  const lists = '@react-native/virtualized-lists/package.json';
  assert.equal(
    components.resolve(lists),
    native.resolve(lists),
    'Shared components must use the host SDK Virtualized Lists package',
  );
  assert.equal(
    JSON.parse(readFileSync(native.resolve(lists), 'utf8')).version,
    JSON.parse(
      readFileSync(consumer.resolve('react-native/package.json'), 'utf8'),
    ).version,
    'Virtualized Lists must match the host React Native version',
  );
}

function sourcePaths(map) {
  return map.sections
    ? map.sections.flatMap(section => sourcePaths(section.map))
    : map.sources;
}

export function verifyLinuxConsumerBundle(map, framework = 'react') {
  const sources = sourcePaths(map);
  for (const source of [
    '@symbiote-native/engine/build/platform/index.linux.js',
    `@symbiote-native/${framework}/build/${framework === 'angular' ? 'angular/render/index.js' : 'render.js'}`,
    '@symbiote-native/components/build/component-names/index.linux.js',
    `@symbiote-native/${framework}/build/${framework === 'angular' ? 'angular/' : ''}register.js`,
  ]) {
    assert(
      sources.some(path => path.endsWith(source)),
      `Metro did not include ${source}`,
    );
  }
  if (framework === 'vue') verifyVueRuntime(sources);

  assert(
    !sources.some(path => path.includes('@symbiote-native/engine/src/')),
    'Metro reached workspace source instead of the packed engine',
  );
}
