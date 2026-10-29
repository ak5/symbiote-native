import { describe, expect, it } from 'vitest';
import { VOID_COMPONENT } from '@symbiote-native/engine';
import { descriptorFor } from './index.windows';

describe('Windows text input', () => {
  it.each(['text-input', 'text-input-multiline'])(
    'resolves %s to the registered Windows component',
    tag => {
      expect(descriptorFor(tag)).toEqual({
        component: 'WindowsTextInput',
        isText: false,
      });
    },
  );
});

describe('Windows non-iOS wrappers', () => {
  it('renders SafeAreaView as the same native View as RNW', () => {
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
});
