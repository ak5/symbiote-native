import { describe, expect, it } from 'vitest';
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
