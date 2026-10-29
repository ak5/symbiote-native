import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('a failed window journey preserves its trace and still runs the remaining journeys', () => {
  const root = mkdtempSync(join(tmpdir(), 'symbiote-window-runner-'));
  try {
    const host = join(root, 'host');
    const matrix = join(root, 'matrix');
    mkdirSync(join(host, 'scripts'), { recursive: true });
    mkdirSync(join(host, 'packages'));
    for (const framework of ['react', 'svelte', 'vue', 'solid']) {
      mkdirSync(join(matrix, framework), { recursive: true });
      writeFileSync(join(matrix, framework, 'index.linux.bundle.js'), '');
    }
    writeFileSync(
      join(host, 'scripts/e2e.ts'),
      `
      const fs = require('node:fs');
      const name = process.argv.at(-1);
      fs.appendFileSync('attempts', name + '\\n');
      const output = 'build/e2e/' + name;
      fs.mkdirSync(output, { recursive: true });
      if (name === 'symbiote-react-input') {
        fs.writeFileSync(output + '/trace.log', 'native failure evidence');
        process.exit(1);
      }
      fs.writeFileSync(output + '/screenshot.png', 'screenshot');
    `,
    );
    const run = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL('../scripts/run-linux-window-consumers.mjs', import.meta.url),
        ),
        host,
        matrix,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(run.status, 1);
    assert.match(run.stderr, /native failure evidence/);
    assert.match(run.stderr, /Native window scenarios failed/);
    assert.deepEqual(
      readFileSync(join(host, 'attempts'), 'utf8').trim().split('\n'),
      [
        'symbiote-react-input',
        'symbiote-react-resize',
        'symbiote-svelte-input',
        'symbiote-svelte-resize',
        'symbiote-vue-input',
        'symbiote-vue-resize',
        'symbiote-solid-input',
        'symbiote-solid-resize',
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
