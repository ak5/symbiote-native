export function viewportLabel({ width, height }) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 0 ||
    height < 0
  )
    throw new Error('Invalid native window dimensions');
  return `Viewport: ${width.toFixed(2)}x${height.toFixed(2)}`;
}

export function createLayoutProbe(framework, platform, update, probe) {
  const fail = message => {
    probe.reportFailure(`${framework}: ${message}`);
    throw new Error(message);
  };
  if (
    platform.OS !== 'windows' ||
    platform.constants?.reactNativeVersion?.minor !== 85 ||
    platform.select({ windows: 'windows', native: 'native' }) !== 'windows'
  ) {
    fail(
      `The packaged adapter did not resolve the Windows host: ${JSON.stringify({
        OS: platform.OS,
        constants: platform.constants ?? null,
        selected: platform.select({ windows: 'windows', native: 'native' }),
      })}`,
    );
  }
  let initial = false;
  let complete = false;
  return event => {
    if (complete) return;
    const layout = event?.nativeEvent?.layout;
    if (!layout || layout.height !== 80 || ![120, 240].includes(layout.width)) {
      fail('Unexpected native view layout');
    }
    if (!initial) {
      if (layout.width !== 120)
        fail('The initial native layout was not observed');
      initial = true;
      update();
    } else if (layout.width === 240) {
      complete = true;
      if (!globalThis.__symbioteEngineNative)
        fail('Native engine bindings are missing');
      probe.reportResult(`${framework} native layout 120->240`);
    }
  };
}
