import { describe, expect, it } from 'vitest';
import { VOID_COMPONENT } from '@symbiote-native/engine';
import { descriptorFor } from './index.linux';

describe('Linux non-iOS wrappers', () => {
  it('renders SafeAreaView as a native View, matching React Native', () => {
    expect(descriptorFor('safe-area-view')).toEqual({
      component: 'RCTView',
      isText: false,
    });
  });
  it('omits the whole iOS-only InputAccessoryView subtree', () => {
    expect(descriptorFor('input-accessory-view')).toEqual({
      component: VOID_COMPONENT,
      isText: false,
    });
  });
  it('preserves the host-resolved text-input names', () => {
    expect(descriptorFor('text-input').component).toBe(
      'RCTSinglelineTextInputView',
    );
    expect(descriptorFor('text-input-multiline').component).toBe(
      'RCTMultilineTextInputView',
    );
  });
});
