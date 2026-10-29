import { afterEach, expect, it, vi } from 'vitest';

const constants = {
  osVersion: 19,
  isTesting: true,
  reactNativeVersion: { major: 0, minor: 85, patch: 3 },
  reactNativeWindowsVersion: { major: 0, minor: 85, patch: 0 },
};

async function load(payload: unknown = constants) {
  vi.resetModules();
  vi.stubGlobal('__DEV__', true);
  vi.stubGlobal('__turboModuleProxy', (name: string) =>
    name === 'PlatformConstants' ? { getConstants: () => payload } : null,
  );
  vi.stubGlobal('nativeModuleProxy', {});
  return (await import('./index.windows')).Platform;
}

afterEach(() => vi.unstubAllGlobals());

it('uses the Windows API contract level and preserves both native versions', async () => {
  const platform = await load();
  expect(platform.OS).toBe('windows');
  expect(platform.Version).toBe(19);
  expect(platform.constants).toEqual(constants);
  expect([
    platform.isPad,
    platform.isTV,
    platform.isVision,
    platform.isMacCatalyst,
  ]).toEqual([false, false, false, false]);
});

it('selects Windows before native/default and preserves explicit undefined', async () => {
  const platform = await load();
  expect(platform.select({ windows: 'W', native: 'N', default: 'D' })).toBe(
    'W',
  );
  expect(platform.select({ ios: 'I', native: 'N', default: 'D' })).toBe('N');
  expect(platform.select({ default: 'D' })).toBe('D');
  expect(platform.select({ windows: undefined, default: 'D' })).toBeUndefined();
  expect(platform.select({ ios: 'I' })).toBeUndefined();
});

it('gates testing in release builds while honoring explicit animation settings', async () => {
  const platform = await load();
  expect(platform.isTesting).toBe(true);
  expect(platform.isDisableAnimations).toBe(true);
  vi.stubGlobal('__DEV__', false);
  expect(platform.isTesting).toBe(false);
  expect(platform.isDisableAnimations).toBe(false);
  const explicit = await load({ ...constants, isDisableAnimations: true });
  vi.stubGlobal('__DEV__', false);
  expect(explicit.isDisableAnimations).toBe(true);
});

it.each([
  null,
  { ...constants, osVersion: '19' },
  { ...constants, reactNativeWindowsVersion: null },
  { ...constants, reactNativeVersion: { major: 0, minor: 85, patch: '3' } },
  { ...constants, isDisableAnimations: 'false' },
])('does not cache malformed native constants: %j', async payload => {
  const platform = await load(payload);
  expect(platform.Version).toBe(0);
  expect(platform.constants).toBeUndefined();
  expect(platform.isTesting).toBe(false);
  vi.stubGlobal('__turboModuleProxy', (name: string) =>
    name === 'PlatformConstants' ? { getConstants: () => constants } : null,
  );
  expect(platform.Version).toBe(19);
});
