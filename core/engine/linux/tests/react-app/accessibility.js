import { createElement, useState } from 'react';
import {
  AppRegistry as NativeAppRegistry,
  TurboModuleRegistry,
} from 'react-native';
import { Platform } from '@symbiote-native/react';
import { registerApp } from '@symbiote-native/react/bootstrap';
import { dlog } from '@symbiote-native/engine';

if (Platform.OS !== 'linux')
  throw new Error('Expected the native Linux adapter');

const textStyle = { color: '#ffffff', height: 28 };
const fieldStyle = { ...textStyle, width: 260, height: 40 };
const unicode = 'café 雪 🐧';
const longCluster = `a${'\u0301'.repeat(128)}`;

function App() {
  const [count, setCount] = useState(0);
  const [value, setValue] = useState('é🐧z');
  const [empty, setEmpty] = useState('');
  const [custom, setCustom] = useState('none');
  const [reverseActions, setReverseActions] = useState(false);
  const declaredActions = [
    { name: 'archive', label: 'Archive item' },
    { name: 'copyId', label: 'Copy identifier' },
  ];
  /** @type {import('@symbiote-native/react').IViewProps} */
  const customProps = {
    accessible: true,
    role: 'group',
    accessibilityLabel: 'Native custom actions',
    accessibilityActions: reverseActions
      ? [...declaredActions].reverse()
      : declaredActions,
    style: { width: 300, height: 48 },
    onAccessibilityAction: event => {
      const name = event.nativeEvent.actionName;
      if (name !== 'archive' && name !== 'copyId')
        throw new Error('Unexpected native custom action');
      setCustom(name);
      setReverseActions(true);
      dlog(`AT-SPI native custom action: ${name}`);
    },
  };
  /** @type {import('@symbiote-native/react').ITextInputProps} */
  const editorProps = {
    accessible: true,
    accessibilityLabel: 'Native editor',
    value,
    style: fieldStyle,
    onValueChange: event => {
      setValue(event.text);
      dlog(`AT-SPI native edit: ${event.text}`);
    },
  };
  /** @type {import('@symbiote-native/react').ITextInputProps} */
  const emptyProps = {
    accessible: true,
    accessibilityLabel: 'Empty editor',
    value: empty,
    style: fieldStyle,
    onValueChange: event => {
      setEmpty(event.text);
      dlog(`AT-SPI empty edit: ${event.text}`);
    },
  };
  return createElement(
    'view',
    {
      accessibilityLabel: 'Native group',
      role: 'group',
      style: { width: 600, backgroundColor: '#18293b' },
    },
    createElement('text', { style: textStyle }, unicode),
    createElement('image', {
      accessibilityLabel: 'Native image',
      onLoad: () => dlog('AT-SPI native image loaded'),
      source: {
        uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
      },
      style: { width: 32, height: 32 },
    }),
    createElement(
      'scroll-view',
      {
        accessibilityLabel: 'Native scroll',
        style: { width: 300, height: 80 },
      },
      Array.from({ length: 8 }, (_, row) =>
        createElement(
          'text',
          { key: row, style: textStyle },
          `Native row ${row}`,
        ),
      ),
    ),
    createElement('text-input', editorProps),
    createElement(
      'pressable',
      {
        accessible: true,
        accessibilityRole: 'button',
        accessibilityLabel: 'Native action',
        style: { width: 200, height: 40 },
        onPress: () => {
          setCount(current => current + 1);
          dlog('AT-SPI native action');
        },
      },
      createElement('text', { style: textStyle }, 'Activate'),
    ),
    createElement(
      'text',
      { accessibilityLiveRegion: 'polite', style: textStyle },
      `Native count ${count}`,
    ),
    createElement(
      'pressable',
      {
        accessible: true,
        disabled: true,
        accessibilityLabel: 'Disabled action',
        accessibilityRole: 'button',
        accessibilityState: { disabled: true },
        onPress: () => {
          throw new Error('Disabled control activated');
        },
        style: { width: 200, height: 40 },
      },
      createElement('text', { style: textStyle }, 'Disabled'),
    ),
    createElement('text-input', {
      accessible: true,
      accessibilityLabel: 'Protected editor',
      secureTextEntry: true,
      value: 'private-fixture-only',
      style: fieldStyle,
    }),
    createElement('text-input', {
      accessible: true,
      accessibilityLabel: 'Readonly editor',
      editable: false,
      value: 'readonly café',
      style: fieldStyle,
    }),
    createElement('text-input', emptyProps),
    createElement(
      'view',
      customProps,
      createElement('text', { style: textStyle }, 'Custom actions'),
    ),
    createElement('text', { style: textStyle }, `Native custom ${custom}`),
    createElement(
      'pressable',
      {
        accessible: true,
        accessibilityRole: 'button',
        accessibilityLabel: 'Reload native session',
        style: { width: 240, height: 40 },
        onPress: () => {
          const settings =
            /** @type {import('react-native').TurboModule & { reloadWithReason(reason: string): void }} */ (
              TurboModuleRegistry.getEnforcing('DevSettings')
            );
          settings.reloadWithReason('AT-SPI lifecycle');
        },
      },
      createElement('text', { style: textStyle }, 'Reload session'),
    ),

    createElement('text', { style: textStyle }, longCluster),
    createElement(
      'view',
      { importantForAccessibility: 'no-hide-descendants' },
      createElement('text', { style: textStyle }, 'Hidden private subtree'),
    ),
    createElement(
      'text',
      { style: { display: 'none' } },
      'Display none subtree',
    ),
  );
}

registerApp(App, { appName: 'SymbioteAccessibility', debug: true });
NativeAppRegistry.runApplication('SymbioteAccessibility', {
  initialProps: {},
  rootTag: /** @type {import('react-native').RootTag} */ (
    /** @type {unknown} */ (1)
  ),
});
