import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { verifyLinuxPersistence } from './lib/linux-persistence-probe.mjs';

const [hostArgument, matrixArgument] = process.argv.slice(2);
assert(
  hostArgument && matrixArgument,
  'Usage: run-linux-persistence-consumers.mjs <host> <consumer matrix>',
);
const host = resolve(hostArgument);
const matrix = resolve(matrixArgument);
const { startCompositor, attachTrace, stopCompositor } = await import(
  pathToFileURL(join(host, 'scripts/e2e-processes.ts'))
);
const { findExecutable, findLavapipeIcd } = await import(
  pathToFileURL(join(host, 'scripts/window-golden.ts'))
);
const rig = {
  compositorPath: findExecutable('cage'),
  lavapipeIcdPath: findLavapipeIcd(),
};
assert(
  rig.compositorPath && rig.lavapipeIcdPath,
  'Cage and Lavapipe are required',
);
const artifacts = join(host, 'build/e2e/persistence');
mkdirSync(join(host, 'build/e2e'), { recursive: true });
mkdirSync(artifacts); // Refuse to overwrite an earlier verification.
const failures = [];
for (const framework of ['react', 'svelte', 'vue', 'solid', 'angular']) {
  // Wayland socket paths must fit sockaddr_un; workspace paths can exceed its limit.
  const runtimeDirectory = mkdtempSync(join(tmpdir(), 'rnl-persist-'));
  try {
    for (const phase of ['write', 'read']) {
      const name = `${framework}-${phase}`;
      const bundle = join(artifacts, `${name}.js`);
      writeFileSync(
        bundle,
        readFileSync(join(matrix, framework, 'index.linux.bundle.js'), 'utf8') +
          `\n;(${verifyLinuxPersistence.toString()})(${JSON.stringify(phase)}, globalThis.nativeModuleProxy.RNAsyncStorage, console.log).catch(error => { console.error(error); throw error; });\n`,
      );
      const screenshotPath = join(artifacts, `${name}.png`);
      const compositor = startCompositor({
        bundle,
        rig,
        runtimeDirectory,
        screenshotPath,
        frameLogPath: join(artifacts, `${name}-frames.jsonl`),
        scenario: {
          frames: 900,
          automation: null,
          fastRefresh: null,
          injectProtocolError: false,
        },
      });
      const trace = { text: '', isClosed: false };
      attachTrace(compositor, trace);
      try {
        const [code, signal] = await once(compositor, 'close', {
          signal: AbortSignal.timeout(60_000),
        });
        assert.equal(code, 0, `${name} exited with ${code}/${signal}`);
        assert(
          trace.text.includes(`Symbiote Linux persistence ${phase} passed`),
          `${name} did not verify native storage`,
        );
        assert(
          trace.text.includes(
            `Symbiote Linux ${framework[0].toUpperCase() + framework.slice(1)} app updated`,
          ),
          `${name} did not mount the framework app`,
        );
        assert(
          existsSync(screenshotPath),
          `${name} did not render a native window`,
        );
        console.log(`PASS ${name}: native application persistence`);
      } catch (error) {
        process.stderr.write(trace.text);
        throw error;
      } finally {
        if (!trace.isClosed) await stopCompositor(compositor);
        writeFileSync(join(artifacts, `${name}.log`), trace.text);
      }
    }
  } catch (error) {
    console.error(`${framework} persistence failed:`, error);
    failures.push(error);
  } finally {
    rmSync(runtimeDirectory, { recursive: true, force: true });
  }
}
if (failures.length)
  throw new AggregateError(failures, 'Native application persistence failed');
