// Separate native clients exercise the production Wayland backend on an isolated seat.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  chmodSync,
  createWriteStream,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.platform, 'linux', 'Requires native Wayland clients');
const [probeArgument, outputArgument] = process.argv.slice(2);
assert(
  probeArgument && outputArgument,
  'Expected probe executable and new result directory',
);
const executable = resolve(probeArgument);
const output = resolve(outputArgument);
mkdirSync(output); // Preserve previous verification results.
const runtime = mkdtempSync(join(tmpdir(), 'symbiote-clipboard-'));
chmodSync(runtime, 0o700);
const children = [];
const environment = {
  ...process.env,
  XDG_RUNTIME_DIR: runtime,
  WLR_BACKENDS: 'headless',
  WLR_HEADLESS_OUTPUTS: '1',
  WLR_RENDERER: 'pixman',
  WLR_LIBINPUT_NO_DEVICES: '1',
};

function start(command, args, name, options = {}) {
  const log = createWriteStream(join(output, `${name}.log`), { flags: 'wx' });
  const child = spawn(command, args, {
    env: environment,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });
  const state = {
    child,
    stdout: [],
    stderr: '',
    text: '',
    closed: false,
    code: null,
  };
  children.push(state);
  child.stdout.on('data', bytes => {
    state.stdout.push(bytes);
    state.text += bytes.toString();
    log.write(bytes);
  });
  child.stderr.on('data', bytes => {
    state.stderr += bytes.toString();
    log.write(bytes);
  });
  child.on('error', error => {
    state.error = error;
  });
  // A clipboard owner may be replaced before consuming stdin.
  child.stdin.on('error', error => {
    if (error.code !== 'EPIPE') state.error = error;
  });
  state.completion = new Promise(done => {
    child.on('close', (code, signal) => {
      state.closed = true;
      state.code = code;
      state.signal = signal;
      log.end(() => done(state));
    });
  });
  return state;
}

async function until(check, description, alive = [], milliseconds = 10000) {
  const deadline = Date.now() + milliseconds;
  do {
    if (await check()) return;
    for (const process of alive) {
      assert(
        !process.error && !process.closed,
        `${description}: child exited (${process.code ?? process.error ?? process.signal})\n${process.text}\n${process.stderr}`,
      );
    }
    await delay(25);
  } while (Date.now() < deadline);
  assert.fail(`Timed out: ${description}`);
}

async function stop(state) {
  if (!state.closed) {
    state.child.kill('SIGCONT');
    state.child.kill('SIGTERM');
    await Promise.race([state.completion, delay(1000)]);
    if (!state.closed) state.child.kill('SIGKILL');
  }
  await state.completion;
}

let invocation = 0;
async function command(command, args) {
  const state = start(command, args, `command-${++invocation}`);
  state.child.stdin.end();
  await until(() => state.closed, command, [], 5000);
  assert.equal(state.code, 0, `${command}: ${state.stderr}`);
  return Buffer.concat(state.stdout);
}

function focused(node) {
  return (
    (node.app_id === 'symbiote-clipboard-probe' && node.focused) ||
    [...(node.nodes ?? []), ...(node.floating_nodes ?? [])].some(focused)
  );
}

const mime = 'text/plain;charset=utf-8';
const unicode = Buffer.from('native clipboard 雪 🙂\nsecond line\n');
const external = Buffer.from('external clipboard café 🐧\nlast line\n');
const cases = [
  { name: 'unicode', mode: 'exchange', outgoing: unicode, incoming: external },
  {
    name: 'large',
    mode: 'exchange',
    outgoing: Buffer.from('native-雪🙂\n'.repeat(32768)),
    incoming: Buffer.from('external-🐧é\n'.repeat(32768)),
  },
  {
    name: 'invalid-read',
    mode: 'reject-read',
    outgoing: unicode,
    incoming: Buffer.from([0x61, 0xc0, 0xaf]),
  },
  {
    name: 'invalid-write',
    mode: 'reject-write',
    outgoing: Buffer.from([0xed, 0xa0, 0x80]),
    incoming: external,
  },
  {
    name: 'stalled-owner',
    mode: 'reject-read',
    outgoing: unicode,
    incoming: external,
    stall: true,
  },
  {
    name: 'shutdown-pending',
    mode: 'stop-pending',
    outgoing: unicode,
    incoming: external,
    stall: true,
  },
];

try {
  const config = join(runtime, 'sway.conf');
  writeFileSync(
    config,
    'xwayland disable\noutput * mode 1280x720\nseat seat0 fallback true\n',
  );
  const compositor = start(
    'sway',
    ['--unsupported-gpu', '--config', config],
    'sway',
  );
  await until(
    () => {
      const sockets = readdirSync(runtime).filter(name =>
        statSync(join(runtime, name)).isSocket(),
      );
      environment.WAYLAND_DISPLAY = sockets.find(name =>
        /^wayland-\d+$/.test(name),
      );
      environment.SWAYSOCK = sockets.find(name => name.startsWith('sway-ipc.'));
      if (environment.SWAYSOCK)
        environment.SWAYSOCK = join(runtime, environment.SWAYSOCK);
      return environment.WAYLAND_DISPLAY && environment.SWAYSOCK;
    },
    'isolated compositor startup',
    [compositor],
  );

  for (const fixture of cases) {
    const owned = [];
    const prefix = fixture.name;
    const sentinel = Buffer.from(`untouched clipboard sentinel: ${prefix}`);
    let probe;
    const owner = bytes => {
      const state = start(
        'wl-copy',
        ['--foreground', '--type', mime],
        `${prefix}-owner-${owned.length}`,
      );
      owned.push(state);
      state.child.stdin.end(bytes);
      return state;
    };
    const peerReads = async expected => {
      const state = start(
        'wl-paste',
        ['--no-newline', '--type', mime],
        `${prefix}-read-${++invocation}`,
      );
      owned.push(state);
      state.child.stdin.end();
      await until(
        () => state.closed,
        'external clipboard read',
        [compositor],
        3000,
      );
      return state.code === 0 && Buffer.concat(state.stdout).equals(expected);
    };
    const keys = (symbols, keep = false) => {
      const args = symbols.flatMap(symbol => ['-P', symbol, '-p', symbol]);
      const state = start(
        'wtype',
        ['-s', '300', ...args, ...(keep ? ['-s', '60000'] : [])],
        `${prefix}-keys-${++invocation}`,
      );
      owned.push(state);
      state.child.stdin.end();
      return state;
    };
    try {
      const initialOwner = owner(sentinel);
      await until(() => peerReads(sentinel), 'external sentinel publication', [
        compositor,
        initialOwner,
      ]);
      const copyFile = join(output, `${prefix}-copy.bin`);
      const readFile = join(output, `${prefix}-read.bin`);
      writeFileSync(copyFile, fixture.outgoing);
      writeFileSync(readFile, fixture.incoming);
      probe = start(
        executable,
        [copyFile, readFile, fixture.mode],
        `${prefix}-native`,
        {
          env: { ...environment, WAYLAND_DEBUG: 'client' },
        },
      );
      owned.push(probe);
      probe.child.stdin.end();
      await until(() => probe.text.includes('READY'), 'native window ready', [
        compositor,
        probe,
      ]);
      await until(
        async () =>
          focused(
            JSON.parse(await command('swaymsg', ['-t', 'get_tree', '-r'])),
          ),
        'native window focus',
        [compositor, probe],
      );
      const keyboard = keys(['F1'], true);
      if (fixture.mode === 'reject-write') {
        await until(() => probe.closed, 'invalid write completion', [
          compositor,
        ]);
        assert.equal(probe.code, 0, probe.stderr);
        assert(
          probe.text.includes('PASS: invalid native write rejected'),
          probe.text,
        );
        assert(
          await peerReads(sentinel),
          'Rejected native write must preserve the external clipboard',
        );
      } else {
        await until(
          () => probe.text.includes('PASS: native write acknowledged'),
          'compositor write acknowledgement',
          [compositor, probe, keyboard],
        );
        await until(
          () => peerReads(fixture.outgoing),
          'external client receives exact native bytes',
          [compositor, probe, keyboard],
        );
        const externalOwner = owner(fixture.incoming);
        await until(
          () => peerReads(fixture.incoming),
          'external replacement published',
          [compositor, probe, externalOwner],
        );
        if (fixture.stall) externalOwner.child.kill('SIGSTOP');
        keys(['F2', 'F3']);
        await until(
          () => probe.text.includes('PONG'),
          'UI responds during clipboard read',
          [compositor, keyboard],
        );
        if (fixture.mode === 'stop-pending') {
          await until(
            () => /wl_data_offer@\d+\.receive\(/.test(probe.stderr),
            'native transfer descriptor requested',
            [compositor, probe],
          );
          keys(['F4']);
        }
        await until(
          () => probe.closed,
          'native clipboard completion',
          [compositor],
          5000,
        );
        assert.equal(probe.code, 0, `${probe.text}\n${probe.stderr}`);
        const result =
          fixture.mode === 'exchange'
            ? 'PASS: native read matches external bytes'
            : fixture.mode === 'stop-pending'
              ? 'PASS: shutdown rejects pending native read'
              : 'PASS: native read rejected without returning partial data';
        assert(probe.text.includes(result), probe.text);
        if (fixture.stall)
          assert(
            probe.text.indexOf('PONG') < probe.text.indexOf(result),
            'UI must respond before the stalled transfer completes',
          );
      }
      await probe.completion;
      assert(
        !/AddressSanitizer|UndefinedBehaviorSanitizer|WARNING: ThreadSanitizer|runtime error:/.test(
          probe.stderr,
        ),
        probe.stderr,
      );
      console.log(`PASS: ${prefix}: independent native clipboard clients`);
    } finally {
      for (const state of owned.toReversed()) await stop(state);
    }
  }
} finally {
  for (const state of children.toReversed()) await stop(state);
  rmSync(runtime, { recursive: true });
}
