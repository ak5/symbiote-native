import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createLayoutProbe,
  createScrollProbe,
  viewportLabel,
} from '../core/engine/windows/tests/apps/common.js';

test('viewport labels retain fractional metrics and allow initialization before layout', () => {
  assert.equal(
    viewportLabel({ width: 640.5, height: 480.25 }),
    'Viewport: 640.50x480.25',
  );
  assert.equal(viewportLabel({ width: 0, height: 0 }), 'Viewport: 0.00x0.00');
  for (const width of [NaN, Infinity, -1, undefined])
    assert.throws(
      () => viewportLabel({ width, height: 480 }),
      /Invalid native window dimensions/,
    );
});

const platform = {
  OS: 'windows',
  constants: { reactNativeVersion: { minor: 85 } },
  select: spec => spec.windows,
};
const layout = (width, height = 80) => ({
  nativeEvent: { layout: { width, height } },
});

test('native layouts drive one reactive update and only then report success', () => {
  const previous = globalThis.__symbioteEngineNative;
  globalThis.__symbioteEngineNative = {};
  try {
    const results = [];
    let updates = 0;
    const handler = createLayoutProbe('React', platform, () => updates++, {
      reportResult: result => results.push(result),
      reportFailure: assert.fail,
    });
    handler(layout(120));
    handler(layout(120));
    assert.equal(updates, 1);
    assert.deepEqual(results, []);
    handler(layout(240));
    handler(layout(240));
    assert.deepEqual(results, ['React native layout 120->240']);
  } finally {
    globalThis.__symbioteEngineNative = previous;
  }
});

test('rejects a missing initial layout, invalid native events and a wrong host', () => {
  for (const event of [layout(240), layout(120, 90), {}]) {
    const failures = [];
    const handler = createLayoutProbe('Vue', platform, assert.fail, {
      reportResult: assert.fail,
      reportFailure: message => failures.push(message),
    });
    assert.throws(() => handler(event));
    assert.equal(failures.length, 1);
  }
  assert.throws(
    () =>
      createLayoutProbe('Vue', { ...platform, OS: 'ios' }, assert.fail, {
        reportFailure() {},
      }),
    /Windows host/,
  );
});

test('requires the native engine before reporting a completed application', () => {
  const previous = globalThis.__symbioteEngineNative;
  delete globalThis.__symbioteEngineNative;
  try {
    const failures = [];
    const handler = createLayoutProbe('Svelte', platform, () => {}, {
      reportResult: assert.fail,
      reportFailure: message => failures.push(message),
    });
    handler(layout(120));
    assert.throws(() => handler(layout(240)), /bindings are missing/);
    assert.equal(failures.length, 1);
  } finally {
    globalThis.__symbioteEngineNative = previous;
  }
});

test('scroll success requires a native offset of 200 and reports only once', () => {
  const results = [];
  const failures = [];
  const handler = createScrollProbe('React', {
    reportResult: value => results.push(value),
    reportFailure: value => failures.push(value),
  });
  for (const y of [0, 100, 199])
    handler({ nativeEvent: { contentOffset: { y } } });
  assert.deepEqual(results, []);
  for (const y of [200, 300])
    handler({ nativeEvent: { contentOffset: { y } } });
  assert.deepEqual(results, ['React native scroll passed 200']);
  for (const event of [{}, { nativeEvent: { contentOffset: { y: NaN } } }])
    assert.throws(() => handler(event), /no vertical offset/);
  assert.equal(failures.length, 2);
});
