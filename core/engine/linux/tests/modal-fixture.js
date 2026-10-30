import { TurboModuleRegistry } from 'react-native';

/** @type {Array<'none' | 'fade' | 'slide'>} */
export const modalModes = ['none', 'fade', 'slide'];

/** @type {import('@symbiote-native/engine').IViewStyle} */
export const pageStyle = { flex: 1, backgroundColor: '#142536' };
/** @type {import('@symbiote-native/engine').IViewStyle} */
export const clipStyle = {
  width: 20,
  height: 20,
  left: 100,
  overflow: 'hidden',
  opacity: 0.1,
};
/** @type {import('@symbiote-native/engine').IViewStyle} */
export const cardStyle = {
  position: 'absolute',
  left: 20,
  top: 80,
  width: 280,
  height: 260,
  backgroundColor: '#ffbb33',
};
/** @type {import('@symbiote-native/engine').IViewStyle} */
export const buttonStyle = {
  width: 260,
  height: 38,
  backgroundColor: '#345678',
};
/** @type {import('@symbiote-native/engine').ITextStyle} */
export const fieldStyle = {
  width: 240,
  height: 40,
  color: '#102030',
  backgroundColor: '#ccddee',
};
/** @type {import('@symbiote-native/engine').ITextStyle} */
export const textStyle = { height: 30, color: '#ffffff' };

/** @param {number} shown @param {number} dismissed @param {number} requested @param {number} nested */
export function modalLifecycle(shown, dismissed, requested, nested) {
  return `Modal lifecycle shown=${shown} dismissed=${dismissed} requested=${requested} nested=${nested}`;
}

export function reloadModalRuntime() {
  const settings =
    /** @type {import('react-native').TurboModule & {reloadWithReason(reason: string): void}} */ (
      TurboModuleRegistry.getEnforcing('DevSettings')
    );
  settings.reloadWithReason('Native modal lifecycle');
}
