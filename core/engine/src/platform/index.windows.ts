import { isRecord } from '../type-guards';
import {
  createConstantsResolver,
  gatedIsTesting,
  type IPlatformSelectSpec,
  type IPlatformStatic,
} from './shared';

export type {
  IPlatformOSType,
  IPlatformSelectSpec,
  IPlatformStatic,
} from './shared';

export interface IPlatformConstantsWindows {
  osVersion: number;
  isTesting: boolean;
  isDisableAnimations?: boolean;
  reactNativeVersion: {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string | null;
  };
  reactNativeWindowsVersion: {
    major: number;
    minor: number;
    patch: number;
  };
}

function isVersion(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.major === 'number' &&
    typeof value.minor === 'number' &&
    typeof value.patch === 'number'
  );
}

function isPlatformConstantsWindows(
  value: unknown,
): value is IPlatformConstantsWindows {
  if (!isRecord(value) || !isRecord(value.reactNativeVersion)) return false;
  const prerelease = value.reactNativeVersion.prerelease;
  return (
    typeof value.osVersion === 'number' &&
    typeof value.isTesting === 'boolean' &&
    (value.isDisableAnimations === undefined ||
      typeof value.isDisableAnimations === 'boolean') &&
    isVersion(value.reactNativeVersion) &&
    isVersion(value.reactNativeWindowsVersion) &&
    (prerelease === undefined ||
      prerelease === null ||
      typeof prerelease === 'string')
  );
}

const resolveConstants = createConstantsResolver(isPlatformConstantsWindows);

// Metro selects this before adapters import Platform; Version is the Windows API contract level.
export const Platform: IPlatformStatic<IPlatformConstantsWindows> = {
  OS: 'windows',
  get Version(): number {
    return resolveConstants()?.osVersion ?? 0;
  },
  get constants(): IPlatformConstantsWindows | undefined {
    return resolveConstants();
  },
  isPad: false,
  isTV: false,
  isVision: false,
  isMacCatalyst: false,
  get isTesting(): boolean {
    return gatedIsTesting(resolveConstants());
  },
  get isDisableAnimations(): boolean {
    const constants = resolveConstants();
    return constants?.isDisableAnimations ?? gatedIsTesting(constants);
  },
  select<T>(spec: IPlatformSelectSpec<T>): T | undefined {
    if ('windows' in spec) return spec.windows;
    if ('native' in spec) return spec.native;
    return spec.default;
  },
};
