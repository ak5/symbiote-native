import type { ITextStyle, IViewStyle } from '@symbiote-native/engine';
export const modalModes: Array<'none' | 'fade' | 'slide'>;
export const pageStyle: IViewStyle;
export const clipStyle: IViewStyle;
export const cardStyle: IViewStyle;
export const buttonStyle: IViewStyle;
export const fieldStyle: ITextStyle;
export const textStyle: ITextStyle;
export function modalLifecycle(
  shown: number,
  dismissed: number,
  requested: number,
  nested: number,
): string;
export function reloadModalRuntime(): void;
