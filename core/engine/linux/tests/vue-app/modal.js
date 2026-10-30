import { h, ref } from 'vue';
import { AppRegistry } from 'react-native';
import { Modal, Platform } from '@symbiote-native/vue';
import { createApp } from '@symbiote-native/vue/bootstrap';
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
    const visible = ref(false),
      nested = ref(false),
      mode = ref('none');
    const background = ref('a雪b'),
      value = ref(''),
      nestedValue = ref('');
    const backgroundActions = ref(0),
      shown = ref(0),
      dismissed = ref(0);
    const requested = ref(0),
      nestedClosed = ref(0);
    return () =>
      h('view', { style: pageStyle }, [
        h('text-input', {
          accessible: true,
          accessibilityLabel: 'Modal background',
          style: fieldStyle,
          value: background.value,
          onValueChange: event => (background.value = event.text),
        }),
        button('Background action', () => backgroundActions.value++),
        ...modalModes.map(animation =>
          button(`Open ${animation} modal`, () => {
            mode.value = animation;
            value.value = '';
            nested.value = false;
            visible.value = true;
          }),
        ),
        h(
          'text',
          { style: textStyle },
          `Background count ${backgroundActions.value}`,
        ),
        h(
          'text',
          { style: textStyle },
          modalLifecycle(
            shown.value,
            dismissed.value,
            requested.value,
            nestedClosed.value,
          ),
        ),
        h(
          'text',
          { style: textStyle },
          `Background draft: ${background.value}`,
        ),
        h('view', { style: clipStyle }, [
          h(
            Modal,
            {
              visible: visible.value,
              animationType: mode.value,
              transparent: mode.value === 'slide',
              accessibilityLabel: 'Native modal',
              onShow: () => shown.value++,
              onDismiss: () => dismissed.value++,
              onRequestClose: () => {
                requested.value++;
                visible.value = false;
              },
            },
            () =>
              h('view', { style: cardStyle }, [
                h('text-input', {
                  accessible: true,
                  accessibilityLabel: 'Modal editor',
                  style: fieldStyle,
                  value: value.value,
                  onValueChange: event => (value.value = event.text),
                }),
                h('text', { style: textStyle }, `Modal draft: ${value.value}`),
                h(
                  'text',
                  { style: textStyle },
                  `Modal shown count ${shown.value}`,
                ),
                button('Open nested modal', () => {
                  nestedValue.value = '';
                  nested.value = true;
                }),
                button('Reload modal runtime', reloadModalRuntime),
                h(
                  Modal,
                  {
                    visible: nested.value,
                    animationType: 'fade',
                    accessibilityLabel: 'Native nested modal',
                    onRequestClose: () => (nested.value = false),
                    onDismiss: () => nestedClosed.value++,
                  },
                  () =>
                    h('view', { style: cardStyle }, [
                      h('text-input', {
                        accessible: true,
                        accessibilityLabel: 'Nested editor',
                        style: fieldStyle,
                        value: nestedValue.value,
                        onValueChange: event =>
                          (nestedValue.value = event.text),
                      }),
                    ]),
                ),
              ]),
          ),
        ]),
      ]);
  },
};
createApp(App, { debug: true }).mount('SymbioteLinuxModal');
AppRegistry.runApplication('SymbioteLinuxModal', {
  initialProps: {},
  rootTag: 1,
});
