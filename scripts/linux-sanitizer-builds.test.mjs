import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const environment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
);

test('Skia rejects a different source revision before changing native archives', t => {
  const host = mkdtempSync(path.join(tmpdir(), 'symbiote-skia-pin-'));
  t.after(() => rmSync(host, { recursive: true, force: true }));
  const source = path.join(host, 'third_party/skia');
  mkdirSync(path.join(source, 'lib'), { recursive: true });
  mkdirSync(path.join(host, 'scripts'));
  execFileSync('git', ['init', '-b', 'main', '--quiet', source], {
    env: environment,
  });
  const tree = execFileSync('git', ['mktree'], {
    cwd: source,
    input: '',
    encoding: 'utf8',
    env: environment,
  }).trim();
  const commit = execFileSync(
    'git',
    ['commit-tree', tree, '-m', 'test fixture'],
    {
      cwd: source,
      encoding: 'utf8',
      env: {
        ...environment,
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      },
    },
  ).trim();
  execFileSync('git', ['update-ref', 'HEAD', commit], {
    cwd: source,
    env: environment,
  });
  writeFileSync(
    path.join(host, 'scripts/skia.lock.json'),
    JSON.stringify({ headers: { commit: '0'.repeat(40) } }),
  );
  const archive = path.join(source, 'lib/libskia.a');
  writeFileSync(archive, 'preserve the existing native archive');
  assert.throws(
    () =>
      execFileSync(
        'python3',
        [
          fileURLToPath(new URL('./build-linux-skia.py', import.meta.url)),
          host,
          'asan',
        ],
        { timeout: 5000, stdio: 'pipe', env: environment },
      ),
    /Skia source does not match/,
  );
  assert.equal(
    readFileSync(archive, 'utf8'),
    'preserve the existing native archive',
  );
  assert.equal(
    execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: source,
      encoding: 'utf8',
      env: environment,
    }).trim(),
    commit,
  );
});

test('lavapipe refuses to overwrite an earlier driver build', t => {
  const host = mkdtempSync(path.join(tmpdir(), 'symbiote-lavapipe-build-'));
  t.after(() => rmSync(host, { recursive: true, force: true }));
  const output = path.join(host, 'build/lavapipe-tsan');
  mkdirSync(output, { recursive: true });
  const manifest = path.join(output, 'driver.json');
  writeFileSync(manifest, 'preserve the earlier driver');
  assert.throws(
    () =>
      execFileSync(
        'python3',
        [
          fileURLToPath(new URL('./build-linux-lavapipe.py', import.meta.url)),
          host,
        ],
        { timeout: 5000, stdio: 'pipe' },
      ),
    /FileExistsError/,
  );
  assert.equal(readFileSync(manifest, 'utf8'), 'preserve the earlier driver');
});
