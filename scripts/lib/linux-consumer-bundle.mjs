import assert from 'node:assert/strict';

function sourcePaths(map) {
  return map.sections
    ? map.sections.flatMap(section => sourcePaths(section.map))
    : map.sources;
}

export function verifyLinuxConsumerBundle(map) {
  const sources = sourcePaths(map);
  for (const source of [
    '@symbiote-native/engine/build/platform/index.linux.js',
    '@symbiote-native/react/build/render.js',
  ]) {
    assert(
      sources.some(path => path.endsWith(source)),
      `Metro did not include ${source}`,
    );
  }
  assert(
    !sources.some(path => path.includes('@symbiote-native/engine/src/')),
    'Metro reached workspace source instead of the packed engine',
  );
}
