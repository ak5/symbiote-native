import { isRecord } from '../type-guards';
import {
  createConstantsResolver,
  UNKNOWN_VERSION,
  type IPlatformSelectSpec,
  type IPlatformStatic,
} from './shared';

export type {
  IPlatformOSType,
  IPlatformSelectSpec,
  IPlatformStatic,
} from './shared';

export interface IPlatformConstantsLinux {
  osVersion: string;
  isTesting: boolean;
  isDisableAnimations?: boolean;
  reactNativeVersion: {
    major: number;
    minor: number;
    patch: number;
    prerelease: string | null;
  };
}

function isPlatformConstantsLinux(
  value: unknown,
): value is IPlatformConstantsLinux {
  if (!isRecord(value) || !isRecord(value.reactNativeVersion)) return false;
  const version = value.reactNativeVersion;
  return (
    typeof value.osVersion === 'string' &&
    typeof value.isTesting === 'boolean' &&
    (value.isDisableAnimations === undefined ||
      typeof value.isDisableAnimations === 'boolean') &&
    typeof version.major === 'number' &&
    typeof version.minor === 'number' &&
    typeof version.patch === 'number' &&
    (version.prerelease === null || typeof version.prerelease === 'string')
  );
}

const resolveConstants = createConstantsResolver(isPlatformConstantsLinux);

// Metro selects this file before adapters import Platform; no late host registration is needed.
export const Platform: IPlatformStatic<IPlatformConstantsLinux> = {
  OS: 'linux',
  get Version(): string {
    return resolveConstants()?.osVersion ?? UNKNOWN_VERSION;
  },
  get constants(): IPlatformConstantsLinux | undefined {
    return resolveConstants();
  },
  isPad: false,
  isTV: false,
  isVision: false,
  isMacCatalyst: false,
  get isTesting(): boolean {
    return resolveConstants()?.isTesting ?? false;
  },
  get isDisableAnimations(): boolean {
    const constants = resolveConstants();
    return constants?.isDisableAnimations ?? constants?.isTesting ?? false;
  },
  select<T>(spec: IPlatformSelectSpec<T>): T | undefined {
    if ('linux' in spec) return spec.linux;
    if ('native' in spec) return spec.native;
    return spec.default;
  },
};
