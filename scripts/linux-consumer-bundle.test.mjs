import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyLinuxConsumerBundle } from './lib/linux-consumer-bundle.mjs';

const sources = [
  '/app/node_modules/@symbiote-native/engine/build/platform/index.linux.js',
  '/app/node_modules/@symbiote-native/react/build/render.js',
];

test('accepts both flat and indexed Metro sourcemaps', () => {
  verifyLinuxConsumerBundle({ sources });
  verifyLinuxConsumerBundle({
    sections: sources.map(source => ({ map: { sources: [source] } })),
  });
});

test('checks the selected adapter in a Svelte bundle', () => {
  const svelte = [sources[0], sources[1].replace('/react/', '/svelte/')];
  verifyLinuxConsumerBundle({ sources: svelte }, 'svelte');
  assert.throws(
    () => verifyLinuxConsumerBundle({ sources }, 'svelte'),
    /svelte/,
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
