import { createElement as h, useState } from 'react';
import { AppRegistry } from 'react-native';
import { Modal, Platform } from '@symbiote-native/react';
import { registerApp } from '@symbiote-native/react/bootstrap';
import {
  modalModes,
  pageStyle,
  clipStyle,
  cardStyle,
  buttonStyle,
  fieldStyle,
  textStyle,
  modalLifecycle,
  reloadModalRuntime,
} from './modal-fixture';

if (Platform.OS !== 'linux')
  throw new Error('Expected native Linux modal host');

/** @param {string} label @param {() => void} onPress */
function button(label, onPress) {
  return h(
    'pressable',
    {
      key: label,
      accessible: true,
      accessibilityRole: 'button',
      accessibilityLabel: label,
      style: buttonStyle,
      onPress,
    },
    h('text', { style: textStyle }, label),
  );
}

function App() {
  const [visible, setVisible] = useState(false);
  const [nested, setNested] = useState(false);
  const [mode, setMode] = useState(
    /** @type {'none' | 'fade' | 'slide'} */ ('none'),
  );
  const [background, setBackground] = useState('a雪b');
  const [value, setValue] = useState('');
  const [nestedValue, setNestedValue] = useState('');
  const [backgroundActions, setBackgroundActions] = useState(0);
  const [shown, setShown] = useState(0);
  const [dismissed, setDismissed] = useState(0);
  const [requested, setRequested] = useState(0);
  const [nestedClosed, setNestedClosed] = useState(0);

  /** @type {import('@symbiote-native/react').ITextInputProps} */
  const backgroundInput = {
    accessible: true,
    accessibilityLabel: 'Modal background',
    style: fieldStyle,
    value: background,
    onValueChange: event => setBackground(event.text),
  };
  /** @type {import('@symbiote-native/react').ITextInputProps} */
  const modalInput = {
    accessible: true,
    accessibilityLabel: 'Modal editor',
    style: fieldStyle,
    value: value,
    onValueChange: event => setValue(event.text),
  };
  /** @type {import('@symbiote-native/react').ITextInputProps} */
  const nestedInput = {
    accessible: true,
    accessibilityLabel: 'Nested editor',
    style: fieldStyle,
    value: nestedValue,
    onValueChange: event => setNestedValue(event.text),
  };

  return h(
    'view',
    { style: pageStyle },
    h('text-input', backgroundInput),
    button('Background action', () => setBackgroundActions(count => count + 1)),
    ...modalModes.map(animation =>
      button(`Open ${animation} modal`, () => {
        setMode(animation);
        setValue('');
        setNested(false);
        setVisible(true);
      }),
    ),
    h(
      'text',
      { accessibilityLabel: 'Background count', style: textStyle },
      String(backgroundActions),
    ),
    h(
      'text',
      { accessibilityLabel: 'Modal lifecycle', style: textStyle },
      modalLifecycle(shown, dismissed, requested, nestedClosed),
    ),
    h(
      'view',
      { style: clipStyle },
      h(
        Modal,
        {
          visible,
          animationType: mode,
          transparent: mode === 'slide',
          accessibilityLabel: 'Native modal',
          onShow: () => setShown(count => count + 1),
          onDismiss: () => setDismissed(count => count + 1),
          onRequestClose: () => {
            setRequested(count => count + 1);
            setVisible(false);
          },
        },
        h(
          'view',
          { style: cardStyle },
          h('text-input', modalInput),
          h(
            'text',
            { accessibilityLabel: 'Modal shown count', style: textStyle },
            String(shown),
          ),
          button('Open nested modal', () => {
            setNestedValue('');
            setNested(true);
          }),
          button('Reload modal runtime', reloadModalRuntime),
          h(
            Modal,
            {
              visible: nested,
              animationType: 'fade',
              accessibilityLabel: 'Native nested modal',
              onRequestClose: () => setNested(false),
              onDismiss: () => setNestedClosed(count => count + 1),
            },
            h('view', { style: cardStyle }, h('text-input', nestedInput)),
          ),
        ),
      ),
    ),
  );
}

registerApp(App, { appName: 'SymbioteLinuxModal', debug: true });
AppRegistry.runApplication('SymbioteLinuxModal', {
  initialProps: {},
  rootTag: /** @type {import('react-native').RootTag} */ (
    /** @type {unknown} */ (1)
  ),
});
