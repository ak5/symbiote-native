import type { ISymbioteEvent } from '@symbiote-native/engine';
import type { TurboModule } from 'react-native';

export interface IProbe extends TurboModule {
  reportResult(message: string): void;
  reportFailure(message: string): void;
}

export function createLayoutProbe(
  framework: string,
  platform: {
    OS: string;
    constants?: { reactNativeVersion?: { minor: number } };
    select(spec: { windows: string; native: string }): string | undefined;
  },
  update: () => void,
  probe: IProbe,
): (event: ISymbioteEvent) => void;
