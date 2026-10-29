// Reuse the pinned host's Wayland keyboard/clipboard rig with our Metro bundles.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const [hostArgument, matrixArgument] = process.argv.slice(2);
assert(
  hostArgument && matrixArgument,
  'Usage: run-linux-window-consumers.mjs <host> <consumer matrix>',
);
const host = resolve(hostArgument);
const matrix = resolve(matrixArgument);
const directory = join(host, 'packages/symbiote-consumer');
mkdirSync(directory); // Refuse to replace a host package.
mkdirSync(join(directory, 'e2e'));
mkdirSync(join(directory, 'test-bundles'));

const failures = [];
for (const framework of ['react', 'svelte', 'vue', 'solid', 'angular']) {
  const bundle = `${framework}.js`;
  copyFileSync(
    join(matrix, framework, 'index.linux.bundle.js'),
    join(directory, 'test-bundles', bundle),
  );
  // Resize spans the frame budget so slower first mounts still observe both native extents.
  for (const journey of ['input', 'resize']) {
    const fixture = JSON.parse(
      readFileSync(
        new URL(
          `../core/engine/linux/tests/${journey}-scenario.json`,
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const name = `symbiote-${framework}-${journey}`;
    writeFileSync(
      join(directory, 'e2e', `${name}.json`),
      JSON.stringify({
        ...fixture,
        name,
        bundle,
        ready: `Symbiote Linux ${framework[0].toUpperCase() + framework.slice(1)} app updated`,
      }),
    );
    try {
      execFileSync(process.execPath, ['scripts/e2e.ts', '--scenario', name], {
        cwd: host,
        stdio: 'inherit',
      });
    } catch (error) {
      const trace = join(host, 'build/e2e', name, 'trace.log');
      if (existsSync(trace)) process.stderr.write(readFileSync(trace, 'utf8'));
      failures.push(error);
      continue;
    }
    assert(
      readFileSync(join(host, 'build/e2e', name, 'screenshot.png')).length > 0,
      `${framework} ${journey} window must produce a screenshot`,
    );
  }
}

if (failures.length > 0) {
  throw new AggregateError(failures, 'Native window scenarios failed');
}
