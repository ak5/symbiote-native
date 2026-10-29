import { beforeEach, describe, expect, it } from 'vitest';
import { installRecordingFabric } from '@symbiote-native/test-utils';
import { appendChild, createElement, createSurface, routeProp } from '../index';
import { installEventHandler } from './index';

const fabric = installRecordingFabric();
installEventHandler();
beforeEach(() => fabric.reset());

describe('WindowsTextInput native events', () => {
  it.each([
    ['Focus', 'focus'],
    ['Blur', 'blur'],
    ['Change', 'change'],
    ['EndEditing', 'endEditing'],
    ['SubmitEditing', 'submitEditing'],
    ['KeyPress', 'keyPress'],
    ['SelectionChange', 'selectionChange'],
    ['ContentSizeChange', 'contentSizeChange'],
    ['PressIn', 'pressIn'],
    ['PressOut', 'pressOut'],
    ['Scroll', 'scroll'],
  ])('routes topTextInput%s directly to %s', (suffix, listener) => {
    const surface = createSurface(9_995);
    const parent = createElement('RCTView');
    const input = createElement('WindowsTextInput');
    appendChild(parent, input);
    surface.appendChild(parent);
    surface.commit();
    const delivered: string[] = [];
    const prop = `on${listener.charAt(0).toUpperCase()}${listener.slice(1)}`;
    routeProp(parent, prop, () => delivered.push('parent'));
    routeProp(input, prop, () => delivered.push('input'));

    fabric.fireEvent(input, `topTextInput${suffix}`, { text: 'hello' });

    expect(delivered).toEqual(['input']);
  });
});
