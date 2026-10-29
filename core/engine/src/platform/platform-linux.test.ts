import { afterEach, expect, it, vi } from 'vitest';

const constants = {
  osVersion: '6.8.0',
  isTesting: true,
  reactNativeVersion: { major: 0, minor: 87, patch: 1, prerelease: null },
};

function installConstants(value: unknown): void {
  Object.assign(globalThis, {
    nativeModuleProxy: { PlatformConstants: { getConstants: () => value } },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'nativeModuleProxy');
  vi.resetModules();
});

it('selects Linux before host registration and uses neutral absent-host values', async () => {
  const { Platform } = await import('./index.linux');
  expect(Platform.OS).toBe('linux');
  expect(Platform.Version).toBe('');
  expect(Platform.constants).toBeUndefined();
  expect(Platform.isTesting).toBe(false);
  expect(Platform.isDisableAnimations).toBe(false);
  expect([
    Platform.isPad,
    Platform.isTV,
    Platform.isVision,
    Platform.isMacCatalyst,
  ]).toEqual([false, false, false, false]);
});

it('selects linux, native, then default while preserving explicit empty values', async () => {
  const { Platform } = await import('./index.linux');
  expect(Platform.select({ linux: 0, native: 1, default: 2 })).toBe(0);
  expect(Platform.select({ linux: undefined, native: 1 })).toBeUndefined();
  expect(Platform.select({ native: false, default: true })).toBe(false);
  expect(Platform.select({ ios: 'iOS', default: 'fallback' })).toBe('fallback');
  expect(Platform.select({ ios: 'iOS' })).toBeUndefined();
});

it('reads the native constants even when the host becomes available after the first read', async () => {
  const { Platform } = await import('./index.linux');
  expect(Platform.constants).toBeUndefined();
  installConstants(constants);
  expect(Platform.constants).toBe(constants);
  expect(Platform.Version).toBe('6.8.0');
  expect(Platform.isTesting).toBe(true);
  expect(Platform.isDisableAnimations).toBe(true);
});

it('lets the native animation setting override the testing default', async () => {
  installConstants({ ...constants, isDisableAnimations: false });
  const { Platform } = await import('./index.linux');
  expect(Platform.isTesting).toBe(true);
  expect(Platform.isDisableAnimations).toBe(false);
});

it('rejects malformed constants and can recover on a later native read', async () => {
  installConstants({ ...constants, reactNativeVersion: '0.87.1' });
  const { Platform } = await import('./index.linux');
  expect(Platform.constants).toBeUndefined();
  installConstants(constants);
  expect(Platform.constants).toBe(constants);
});
