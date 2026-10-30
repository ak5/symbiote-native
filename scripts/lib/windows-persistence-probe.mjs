// Appended to installed Metro bundles; this function must remain self-contained.
export async function verifyWindowsPersistence(phase, storage) {
  if (phase !== 'write' && phase !== 'read')
    throw new Error('Invalid persistence phase');
  const key = 'symbiote-desktop-library';
  const value = JSON.stringify({
    revision: 1,
    snippets: ['persisted snippet', '雪'],
  });
  const previous = await storage.getItem(key);
  if (phase === 'write') {
    if (previous !== null)
      throw new Error('Persistence fixture must start with an empty database');
    await storage.setItem(key, value);
  } else if (previous !== value) {
    throw new Error('The relaunched application did not restore its library');
  }
  if ((await storage.getItem(key)) !== value)
    throw new Error('The native store did not preserve the library');
}
