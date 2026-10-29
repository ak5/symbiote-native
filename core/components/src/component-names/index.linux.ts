// React Native's non-iOS SafeAreaView and InputAccessoryView rendering rules.
import { VOID_COMPONENT } from '@symbiote-native/engine';
import { COMPONENT_DESCRIPTORS as IOS_DESCRIPTORS } from './index.ios';
import { makeDescriptorFor } from './shared';
export type { ISymbioteIntrinsic, IComponentDescriptor } from './shared';

export const COMPONENT_DESCRIPTORS = {
  ...IOS_DESCRIPTORS,
  'safe-area-view': { component: 'RCTView', isText: false },
  'input-accessory-view': { component: VOID_COMPONENT, isText: false },
};
export const descriptorFor = makeDescriptorFor(COMPONENT_DESCRIPTORS);
