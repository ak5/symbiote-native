import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyVueRuntime } from './lib/vue-runtime.mjs';
import { verifyLinuxConsumerBundle } from './lib/linux-consumer-bundle.mjs';

const sources = [
  '/app/node_modules/@symbiote-native/engine/build/platform/index.linux.js',
  '/app/node_modules/@symbiote-native/react/build/render.js',
  '/app/node_modules/@symbiote-native/components/build/component-names/index.linux.js',
];

test('accepts both flat and indexed Metro sourcemaps', () => {
  verifyLinuxConsumerBundle({ sources });
  verifyLinuxConsumerBundle({
    sections: sources.map(source => ({ map: { sources: [source] } })),
  });
});

test('checks the selected adapter in a Svelte bundle', () => {
  const svelte = [
    sources[0],
    sources[1].replace('/react/', '/svelte/'),
    sources[2],
  ];
  verifyLinuxConsumerBundle({ sources: svelte }, 'svelte');
  assert.throws(
    () => verifyLinuxConsumerBundle({ sources }, 'svelte'),
    /svelte/,
  );
});

test('rejects fallback component names even when the Linux Platform is present', () => {
  assert.throws(
    () => verifyLinuxConsumerBundle({ sources: sources.slice(0, 2) }),
    /component-names\/index.linux/,
  );
});

test('rejects a bundle that resolves the fallback Platform or omits the adapter', () => {
  assert.throws(
    () =>
      verifyLinuxConsumerBundle({
        sources: [sources[0].replace('.linux', ''), sources[1]],
      }),
    /index.linux.js/,
  );
  assert.throws(
    () => verifyLinuxConsumerBundle({ sources: [sources[0]] }),
    /render.js/,
  );
});

test('rejects source aliases even when the packed entry is also present', () => {
  assert.throws(
    () =>
      verifyLinuxConsumerBundle({
        sources: [...sources, '/app/@symbiote-native/engine/src/index.ts'],
      }),
    /workspace source/,
  );
});

test('requires Angular native AOT renderer output', () => {
  const angular = [
    sources[0],
    '/app/node_modules/@symbiote-native/angular/build/angular/render/index.js',
    sources[2],
  ];
  verifyLinuxConsumerBundle({ sources: angular }, 'angular');
  assert.throws(
    () =>
      verifyLinuxConsumerBundle(
        {
          sources: [
            sources[0],
            '/app/node_modules/@symbiote-native/angular/build/render.js',
          ],
        },
        'angular',
      ),
    /angular\/render\/index/,
  );
});

test('requires one Vue component and reactivity runtime', () => {
  const vue = [
    sources[0],
    '/app/node_modules/@symbiote-native/vue/build/render.js',
    sources[2],
    '/app/node_modules/vue/node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js',
    '/app/node_modules/vue/node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js',
  ];
  verifyLinuxConsumerBundle({ sources: vue }, 'vue');
  for (const runtime of ['runtime-core', 'reactivity']) {
    assert.throws(
      () =>
        verifyLinuxConsumerBundle(
          {
            sources: [
              ...vue,
              `/app/node_modules/@vue/${runtime}/dist/${runtime}.esm-bundler.js`,
            ],
          },
          'vue',
        ),
      /must use one/,
    );
  }
});

test('rejects mixed Vue ESM/CommonJS runtimes and handles Windows source paths', () => {
  const sources = ['runtime-core', 'reactivity'].map(
    name =>
      `C:\\app\\node_modules\\@vue\\${name}\\dist\\${name}.esm-bundler.js`,
  );
  verifyVueRuntime(sources);
  assert.throws(
    () =>
      verifyVueRuntime([
        ...sources,
        '/app/node_modules/@vue/runtime-core/dist/runtime-core.cjs.prod.js',
      ]),
    /must use one runtime-core/,
  );
});
