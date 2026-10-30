import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { verifyWindowsPersistence } from './lib/windows-persistence-probe.mjs';

assert.equal(process.platform, 'win32', 'Native Windows is required');
const [executableArgument, matrixArgument, outputArgument] =
  process.argv.slice(2);
assert(
  executableArgument && matrixArgument && outputArgument,
  'Usage: run-windows-persistence-consumers.mjs <executable> <consumer matrix> <new output directory>',
);
const executable = resolve(executableArgument);
const matrix = resolve(matrixArgument);
const output = resolve(outputArgument);
mkdirSync(output); // Refuse to overwrite earlier results.
const bundle = join(dirname(executable), 'Bundle/index.windows.bundle');
const original = readFileSync(bundle);
const failures = [];
try {
  for (const framework of ['react', 'svelte', 'vue', 'solid', 'angular']) {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'symbiote-storage-'));
    const database = join(dataDirectory, 'AsyncStorage.db');
    try {
      for (const phase of ['write', 'read']) {
        const name = `${framework}-${phase}`;
        const directory = join(output, name);
        mkdirSync(directory);
        const marker = `PASS: Windows persistence ${phase}`;
        const tail = `\n;{
          const harness = globalThis.__symbiotePersistenceProbe;
          if (!harness) throw new Error('The installed app did not expose its native storage provider');
          (${verifyWindowsPersistence.toString()})(${JSON.stringify(phase)}, harness.storage)
            .then(() => harness.native.reportResult(${JSON.stringify(`Windows persistence ${phase}`)}))
            .catch(error => harness.native.reportFailure(String(error?.stack ?? error)));
        }\n`;
        writeFileSync(
          bundle,
          readFileSync(
            join(matrix, framework, 'index.windows.bundle'),
            'utf8',
          ) + tail,
        );
        // The SDK resolves its bundle/DLLs from the executable; each process gets a fresh log directory.
        const child = spawn(executable, [], {
          cwd: directory,
          env: { ...process.env, SYMBIOTE_PERSISTENCE_DATABASE: database },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stopped = false;
        let launchError;
        const closed = new Promise(resolve =>
          child.once('close', () => {
            stopped = true;
            resolve();
          }),
        );
        child.once('error', error => {
          launchError = error;
        });
        for (const stream of [child.stdout, child.stderr])
          stream?.on('data', data =>
            writeFileSync(join(directory, 'launch.log'), data, { flag: 'a' }),
          );
        const logPath = join(directory, 'windows-fabric-runtime.log');
        try {
          const title = framework[0].toUpperCase() + framework.slice(1);
          const layout = `PASS: ${title} native layout 120->240`;
          const deadline = Date.now() + 90_000;
          let log = '';
          while (Date.now() < deadline) {
            if (existsSync(logPath)) log = readFileSync(logPath, 'utf8');
            if (launchError) throw launchError;
            if (
              log.includes('FAIL:') ||
              (log.includes(marker) && log.includes(layout)) ||
              stopped
            )
              break;
            await delay(250);
          }
          assert(!log.includes('FAIL:'), `${name} native failure: ${log}`);
          assert(
            !stopped,
            `${name} exited before native verification: ${child.exitCode}/${child.signalCode}: ${log}`,
          );
          assert(
            log.includes(layout),
            `${name} did not mount and update its native framework app: ${log}`,
          );
          assert(
            log.includes(marker),
            `${name} did not verify native storage: ${log}`,
          );
        } finally {
          if (!stopped) child.kill();
          await closed;
        }
        assert(
          existsSync(database),
          `${name} did not create a native database`,
        );
        assert.equal(
          readFileSync(database).subarray(0, 16).toString('binary'),
          'SQLite format 3\0',
        );
        console.log(`PASS ${name}: native SQLite persistence`);
      }
    } catch (error) {
      console.error(`${framework} persistence failed:`, error);
      failures.push(error);
    } finally {
      if (existsSync(database))
        copyFileSync(database, join(output, `${framework}.db`));
      rmSync(dataDirectory, { recursive: true, force: true });
    }
  }
} finally {
  writeFileSync(bundle, original);
}
if (failures.length)
  throw new AggregateError(failures, 'Native Windows persistence failed');
