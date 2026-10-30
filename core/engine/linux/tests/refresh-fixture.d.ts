import type { IViewStyle } from '@symbiote-native/engine';
export const rowStyle: IViewStyle;
export const scrollStyle: IViewStyle;
export const contentStyle: IViewStyle;
export const controlsStyle: IViewStyle;
export const refreshProps: {
  accessibilityLabel: string;
  tintColor: '#ffdd66';
  title: string;
  titleColor: '#99bbff';
  progressViewOffset: number;
};
export function refreshStatus(
  accept: boolean,
  accepted: number,
  rejected: number,
  refreshing: boolean,
  mounted: boolean,
): string;
