import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { verifyLinuxPersistence } from './lib/linux-persistence-probe.mjs';

function store() {
  const databases = new Map();
  return {
    async getValues(database, keys) {
      return keys.map(key => ({
        key,
        value: databases.get(`${database}/${key}`) ?? null,
      }));
    },
    async setValues(database, entries) {
      for (const { key, value } of entries)
        databases.set(`${database}/${key}`, value);
    },
  };
}

test('the serialized probe writes a fresh library and verifies it after reopening', async () => {
  const storage = store();
  const messages = [];
  for (const phase of ['write', 'read']) {
    await runInNewContext(
      `(${verifyLinuxPersistence.toString()})(phase, storage, report)`,
      {
        phase,
        storage,
        report: message => messages.push(message),
      },
    );
  }
  assert.deepEqual(messages, [
    'Symbiote Linux persistence write passed',
    'Symbiote Linux persistence read passed',
  ]);
});

test('fails for lost data, a dirty fixture, invalid phases and native write errors', async () => {
  const storage = store();
  await assert.rejects(
    verifyLinuxPersistence('read', storage, assert.fail),
    /restore/,
  );
  await verifyLinuxPersistence('write', storage, () => {});
  await assert.rejects(
    verifyLinuxPersistence('write', storage, assert.fail),
    /empty database/,
  );
  await assert.rejects(
    verifyLinuxPersistence('other', storage, assert.fail),
    /Invalid/,
  );
  await assert.rejects(
    verifyLinuxPersistence(
      'write',
      {
        ...store(),
        async setValues() {
          throw new Error('disk full');
        },
      },
      assert.fail,
    ),
    /disk full/,
  );
});

test('does not report success when a write silently loses the library', async () => {
  await assert.rejects(
    verifyLinuxPersistence(
      'write',
      {
        ...store(),
        async setValues() {},
      },
      assert.fail,
    ),
    /preserve the library/,
  );
});
