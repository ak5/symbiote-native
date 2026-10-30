import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { verifyWindowsPersistence } from './lib/windows-persistence-probe.mjs';

function storage(data = new Map()) {
  return {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
}

test('serialized probe writes Unicode and restores it through a fresh storage handle', async () => {
  const probe = runInNewContext(`(${verifyWindowsPersistence.toString()})`);
  const data = new Map();
  await probe('write', storage(data));
  assert.match([...data.values()][0], /雪/);
  await probe('read', storage(data));
});

test('rejects lost data without writing during the read phase', async () => {
  await assert.rejects(
    verifyWindowsPersistence('read', {
      getItem: async () => null,
      setItem: assert.fail,
    }),
    /did not restore/,
  );
  await assert.rejects(
    verifyWindowsPersistence('write', {
      getItem: async () => null,
      setItem: async () => {},
    }),
    /did not preserve/,
  );
});

test('preserves existing data and propagates native write failures', async () => {
  const data = new Map([['symbiote-desktop-library', 'existing library']]);
  await assert.rejects(
    verifyWindowsPersistence('write', storage(data)),
    /empty database/,
  );
  assert.equal(data.get('symbiote-desktop-library'), 'existing library');
  await assert.rejects(
    verifyWindowsPersistence('write', {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('disk full');
      },
    }),
    /disk full/,
  );
});

test('rejects an invalid phase before accessing native storage', async () => {
  await assert.rejects(
    verifyWindowsPersistence('delete', {}),
    /Invalid persistence phase/,
  );
});
