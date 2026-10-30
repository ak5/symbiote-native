import { h, ref } from 'vue';
import { AppRegistry } from 'react-native';
import { Modal, Platform } from '@symbiote-native/vue';
import { createApp } from '@symbiote-native/vue/bootstrap';
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
    [h('text', { style: textStyle }, label)],
  );

const App = {
  setup() {
    const draft = ref('a雪b'),
      accept = ref(true),
      accepted = ref(0),
      rejected = ref(0);
    const refreshing = ref(false),
      mounted = ref(true),
      modal = ref(false);
    const onRefresh = () => {
      if (accept.value) {
        accepted.value++;
        refreshing.value = true;
      } else rejected.value++;
    };
    return () =>
      h('view', { style: pageStyle }, [
        h(
          'text',
          { style: textStyle },
          refreshStatus(
            accept.value,
            accepted.value,
            rejected.value,
            refreshing.value,
            mounted.value,
          ),
        ),
        h('text-input', {
          accessible: true,
          accessibilityLabel: 'Refresh draft',
          style: fieldStyle,
          value: draft.value,
          onValueChange: event => (draft.value = event.text),
        }),
        h('text', { style: textStyle }, `Refresh draft value: ${draft.value}`),
        h('view', { style: rowStyle }, [
          h(
            'scroll-view',
            { accessibilityLabel: 'Refresh scroll', style: scrollStyle },
            [
              mounted.value
                ? h('refresh-control', {
                    ...refreshProps,
                    refreshing: refreshing.value,
                    onRefresh,
                  })
                : null,
              h('view', { style: contentStyle }, [
                h('text', { style: textStyle }, 'Library content'),
              ]),
            ],
          ),
          h('view', { style: controlsStyle }, [
            button('Finish refresh', () => (refreshing.value = false)),
            button('Toggle refresh mode', () => (accept.value = !accept.value)),
            button('Start refresh', () => (refreshing.value = true)),
            button(
              'Toggle refresh control',
              () => (mounted.value = !mounted.value),
            ),
            button('Open refresh modal', () => (modal.value = true)),
            button('Reload refresh runtime', reloadModalRuntime),
          ]),
        ]),
        h(
          Modal,
          {
            visible: modal.value,
            animationType: 'none',
            accessibilityLabel: 'Refresh blocking modal',
            onRequestClose: () => (modal.value = false),
          },
          [
            h('view', { style: cardStyle }, [
              h('text', { style: textStyle }, 'Refresh modal active'),
            ]),
          ],
        ),
      ]);
  },
};

createApp(App, { debug: true }).mount('SymbioteLinuxRefresh');
AppRegistry.runApplication('SymbioteLinuxRefresh', {
  initialProps: {},
  rootTag: 1,
});
