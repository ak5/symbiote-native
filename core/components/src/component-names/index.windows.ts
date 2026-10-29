// RNW registers one WindowsTextInput for both input modes.
import { COMPONENT_DESCRIPTORS as IOS_DESCRIPTORS } from './index.ios';
import { makeDescriptorFor } from './shared';
export type { ISymbioteIntrinsic, IComponentDescriptor } from './shared';

export const COMPONENT_DESCRIPTORS = {
  ...IOS_DESCRIPTORS,
  'text-input': { component: 'WindowsTextInput', isText: false },
  'text-input-multiline': { component: 'WindowsTextInput', isText: false },
};
export const descriptorFor = makeDescriptorFor(COMPONENT_DESCRIPTORS);
