// Serialized into each installed application's bundle; keep this function self-contained.
export async function verifyLinuxPersistence(phase, storage, report) {
  if (phase !== 'write' && phase !== 'read')
    throw new Error('Invalid persistence phase');
  const database = 'symbiote-desktop-verification';
  const key = 'library';
  const value = JSON.stringify({
    revision: 1,
    snippets: ['persisted snippet', '雪'],
  });
  const before = await storage.getValues(database, [key]);
  const previous = before.find(entry => entry.key === key)?.value ?? null;
  if (phase === 'write') {
    if (previous !== null)
      throw new Error('Persistence fixture must start with an empty database');
    await storage.setValues(database, [{ key, value }]);
  } else if (previous !== value) {
    throw new Error('The relaunched application did not restore its library');
  }
  const after = await storage.getValues(database, [key]);
  if (after.find(entry => entry.key === key)?.value !== value)
    throw new Error('The native store did not preserve the library');
  report(`Symbiote Linux persistence ${phase} passed`);
}
