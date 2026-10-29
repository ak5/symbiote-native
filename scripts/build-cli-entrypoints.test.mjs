import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repository = fileURLToPath(new URL('../', import.meta.url));

test('build CLIs execute from Windows paths and URL-escaped entry paths', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'symbiote-build-cli-'));
  try {
    const tools = join(fixture, 'entry scripts #');
    symlinkSync(join(repository, 'scripts'), tools, 'junction');
    symlinkSync(
      join(repository, 'node_modules'),
      join(fixture, 'node_modules'),
      'junction',
    );
    const pkg = join(fixture, 'packages/fixture');
    mkdirSync(join(pkg, 'src'), { recursive: true });
    mkdirSync(join(pkg, 'build'));
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({ name: '@symbiote-native/fixture' }),
    );
    writeFileSync(join(pkg, 'src/Fixture.svelte'), '<text>fixture</text>');
    const run = (script, ...args) =>
      execFileSync(
        process.execPath,
        ['--preserve-symlinks-main', join(tools, script), ...args],
        { cwd: fixture, encoding: 'utf8' },
      );

    assert.match(run('copy-svelte-sources.mjs'), /files copied to build\/: 1/);
    assert.equal(
      readFileSync(join(pkg, 'build/Fixture.svelte'), 'utf8'),
      '<text>fixture</text>',
    );

    writeFileSync(join(pkg, 'build/a.js'), "export { value } from './b';");
    writeFileSync(join(pkg, 'build/b.js'), 'export const value = 1;');
    assert.match(
      run('fix-esm-extensions.mjs', join(pkg, 'build')),
      /Import specifiers fixed: 1/,
    );
    assert.match(
      readFileSync(join(pkg, 'build/a.js'), 'utf8'),
      /from '.\/b.js'/,
    );

    // No publishable packages: declaration CLI entry must still execute, without compiling fixtures.
    rmSync(join(fixture, 'packages'), { recursive: true });
    assert.match(
      run('emit-svelte-declarations.mjs'),
      /declarations emitted into build\/: 0/,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
