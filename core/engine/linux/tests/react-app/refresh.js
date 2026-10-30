import { createElement as h, useState } from 'react';
import { AppRegistry } from 'react-native';
import { Modal, Platform } from '@symbiote-native/react';
import { registerApp } from '@symbiote-native/react/bootstrap';
import {
  pageStyle,
  buttonStyle,
  fieldStyle,
  textStyle,
  cardStyle,
  reloadModalRuntime,
} from './modal-fixture';
import {
  rowStyle,
  scrollStyle,
  contentStyle,
  controlsStyle,
  refreshProps,
  refreshStatus,
} from './refresh-fixture';

if (Platform.OS !== 'linux')
  throw new Error('Expected native Linux refresh host');

/** @param {string} label @param {() => void} onPress */
const button = (label, onPress) =>
  h(
    'pressable',
    {
      accessible: true,
      accessibilityRole: 'button',
      accessibilityLabel: label,
      style: buttonStyle,
      onPress,
    },
    h('text', { style: textStyle }, label),
  );

function App() {
  const [draft, setDraft] = useState('a雪b');
  const [accept, setAccept] = useState(true);
  const [accepted, setAccepted] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [modal, setModal] = useState(false);
  /** @type {import('@symbiote-native/react').ITextInputProps} */
  const input = {
    accessible: true,
    accessibilityLabel: 'Refresh draft',
    style: fieldStyle,
    value: draft,
    onValueChange: event => setDraft(event.text),
  };
  /** @type {import('@symbiote-native/react').IRefreshControlProps} */
  const refresh = {
    ...refreshProps,
    refreshing,
    onRefresh: () => {
      if (accept) {
        setAccepted(n => n + 1);
        setRefreshing(true);
      } else setRejected(n => n + 1);
    },
  };
  return h(
    'view',
    { style: pageStyle },
    h(
      'text',
      { style: textStyle },
      refreshStatus(accept, accepted, rejected, refreshing, mounted),
    ),
    h('text-input', input),
    h('text', { style: textStyle }, `Refresh draft value: ${draft}`),
    h(
      'view',
      { style: rowStyle },
      h(
        'scroll-view',
        { accessibilityLabel: 'Refresh scroll', style: scrollStyle },
        mounted ? h('refresh-control', refresh) : null,
        h(
          'view',
          { style: contentStyle },
          h('text', { style: textStyle }, 'Library content'),
        ),
      ),
      h(
        'view',
        { style: controlsStyle },
        button('Finish refresh', () => setRefreshing(false)),
        button('Toggle refresh mode', () => setAccept(value => !value)),
        button('Start refresh', () => setRefreshing(true)),
        button('Toggle refresh control', () => setMounted(value => !value)),
        button('Open refresh modal', () => setModal(true)),
        button('Reload refresh runtime', reloadModalRuntime),
      ),
    ),
    h(
      Modal,
      {
        visible: modal,
        animationType: 'none',
        accessibilityLabel: 'Refresh blocking modal',
        onRequestClose: () => setModal(false),
      },
      h(
        'view',
        { style: cardStyle },
        h('text', { style: textStyle }, 'Refresh modal active'),
      ),
    ),
  );
}

registerApp(App, { appName: 'SymbioteLinuxRefresh', debug: true });
AppRegistry.runApplication('SymbioteLinuxRefresh', {
  initialProps: {},
  rootTag: /** @type {import('react-native').RootTag} */ (
    /** @type {unknown} */ (1)
  ),
});
