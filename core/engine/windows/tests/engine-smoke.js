// Exercises the production wire format against the native engine, without a second tree.
export function verifyEngine(surface, engine) {
  if (engine?.version !== 4) throw new Error('Expected native engine ABI 4');
  const handles = [{}];
  const instances = [{}];
  const strings = ['RCTView', 'width', 'height'];
  const apply = (words, values) => {
    const ops = engine.allocInt32Array(words.length);
    ops.set(words);
    engine.applyOps(ops, strings, values, instances, handles);
  };
  const measure = width => {
    let measured = false;
    engine.measure(handles[0], (_x, _y, actualWidth, height) => {
      if (actualWidth !== width || height !== 80)
        throw new Error('Engine layout did not match its commit');
      measured = true;
    });
    if (!measured) throw new Error('Native measure did not complete');
  };
  apply(
    [
      0,
      0,
      0,
      0,
      0,
      -1,
      6,
      0,
      1,
      0,
      -1,
      -1,
      6,
      0,
      2,
      1,
      -1,
      -1,
      8,
      surface,
      0,
      -1,
      -1,
      -1,
    ],
    [120, 80],
  );
  measure(120);
  apply([6, 0, 1, 0, -1, -1, 8, surface, 0, -1, -1, -1], [240]);
  measure(240);
}
