// CI-only disposable consumer. Real examples keep registry dependencies in their manifests.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLinuxConsumerBundle } from './lib/linux-consumer-bundle.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const [hostArgument, appArgument] = process.argv.slice(2);
assert(
  hostArgument && appArgument,
  'Usage: prepare-linux-consumer.mjs <host checkout> <new app directory>',
);
const host = resolve(hostArgument);
const matrix = resolve(appArgument);
mkdirSync(matrix); // Refuse to overwrite an existing application.
const packs = join(matrix, 'tarballs');
mkdirSync(packs);

function run(command, args, cwd = repository) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, npm_config_workspace_concurrency: '1' },
  });
}

const dependencies = {};
function pack(directory) {
  const manifest = JSON.parse(
    readFileSync(join(directory, 'package.json'), 'utf8'),
  );
  run('pnpm', ['pack', '--pack-destination', packs], directory);
  const archive = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`;
  return { [manifest.name]: `file:${join(packs, archive)}` };
}

run('pnpm', ['run', 'prepublish-build']);
for (const directory of ['core/engine', 'core/components', 'core/css-parser']) {
  Object.assign(dependencies, pack(join(repository, directory)));
}
// The host's own pack configuration emits the CLI exports consumed by Metro. This test runs
// the separately compiled hello_react executable, so it needs no packaged window binary.
run('pnpm', ['exec', 'tsc', '-p', 'packages/cli/tsconfig.pack.json'], host);
Object.assign(dependencies, pack(join(host, 'packages/core')));
Object.assign(dependencies, pack(join(host, 'packages/cli')));
const template = JSON.parse(
  readFileSync(join(host, 'packages/template/template/package.json'), 'utf8'),
);
const reactExample = JSON.parse(
  readFileSync(join(repository, 'examples/react/package.json'), 'utf8'),
);
for (const framework of ['react', 'svelte', 'vue', 'solid']) {
  const app = join(matrix, framework);
  mkdirSync(app);
  const appDependencies = {
    ...dependencies,
    ...pack(join(repository, 'adapters', framework)),
  };
  if (framework === 'solid') {
    appDependencies['solid-js'] = JSON.parse(
      readFileSync(
        join(repository, 'adapters/solid/node_modules/solid-js/package.json'),
        'utf8',
      ),
    ).version;
  }
  if (framework === 'vue') {
    appDependencies.vue = JSON.parse(
      readFileSync(
        join(repository, 'adapters/vue/node_modules/vue/package.json'),
        'utf8',
      ),
    ).version;
  }
  if (framework === 'svelte') {
    appDependencies.svelte = JSON.parse(
      readFileSync(
        join(repository, 'node_modules/svelte/package.json'),
        'utf8',
      ),
    ).version;
    copyFileSync(
      join(repository, 'examples/svelte/metro.config.js'),
      join(app, 'metro.adapter.cjs'),
    );
  }
  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify(
      {
        name: 'symbiote-linux-consumer',
        version: '0.0.0',
        private: true,
        dependencies: {
          ...template.dependencies,
          ...template.devDependencies,
          '@types/react': reactExample.devDependencies['@types/react'],
          typescript: reactExample.devDependencies.typescript,
          ...appDependencies,
        },
      },
      null,
      2,
    ) + '\n',
  );
  copyFileSync(
    join(repository, 'core/engine/linux/tests/react-app/babel.config.cjs'),
    join(app, 'babel.config.cjs'),
  );
  cpSync(join(repository, `core/engine/linux/tests/${framework}-app`), app, {
    recursive: true,
  });
  run('npm', ['install', '--no-audit', '--no-fund'], app);

  if (framework === 'react') {
    run(
      join(app, 'node_modules/.bin/tsc'),
      ['--project', 'tsconfig.json'],
      app,
    );
  }

  for (const [name, archive] of Object.entries(appDependencies)) {
    if (!archive.startsWith('file:')) continue;
    const installed = JSON.parse(
      readFileSync(join(app, 'node_modules', name, 'package.json'), 'utf8'),
    );
    const packed = JSON.parse(
      execFileSync('tar', ['-xOf', archive.slice(5), 'package/package.json'], {
        encoding: 'utf8',
      }),
    );
    assert.deepEqual(
      installed,
      packed,
      `${name} must come from the current checkout`,
    );
  }
  run(
    join(app, 'node_modules/.bin/metro'),
    [
      'build',
      'index.js',
      '--platform',
      'linux',
      '--dev',
      'false',
      '--out',
      join(app, 'index.linux.bundle.js'),
      '--source-map',
      '--max-workers',
      '1',
    ],
    app,
  );
  verifyLinuxConsumerBundle(
    JSON.parse(readFileSync(join(app, 'index.linux.bundle.map'), 'utf8')),
    framework,
  );
  process.stdout.write(
    `Linux consumer bundle: ${join(app, 'index.linux.bundle.js')}\n`,
  );
}
