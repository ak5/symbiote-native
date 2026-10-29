import assert from 'node:assert/strict';

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
  ]) {
    assert(
      sources.some(path => path.endsWith(source)),
      `Metro did not include ${source}`,
    );
  }
  if (framework === 'vue') {
    for (const runtime of ['runtime-core', 'reactivity']) {
      const entries = new Set(
        sources.filter(path =>
          path.includes(`/@vue/${runtime}/dist/${runtime}.`),
        ),
      );
      assert.equal(
        entries.size,
        1,
        `Vue must use one ${runtime} instance from its peer runtime`,
      );
    }
  }
  assert(
    !sources.some(path => path.includes('@symbiote-native/engine/src/')),
    'Metro reached workspace source instead of the packed engine',
  );
}
