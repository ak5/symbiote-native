import assert from 'node:assert/strict';

export function verifyVueRuntime(sources) {
  for (const runtime of ['runtime-core', 'reactivity']) {
    const entries = new Set(
      sources
        .map(path => path.replaceAll('\\', '/'))
        .filter(path => path.includes(`/@vue/${runtime}/dist/${runtime}.`)),
    );
    assert.equal(
      entries.size,
      1,
      `Vue must use one ${runtime} instance from its peer runtime`,
    );
  }
}
