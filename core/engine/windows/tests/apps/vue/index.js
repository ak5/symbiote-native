import { h, ref } from 'vue';
import { TurboModuleRegistry } from 'react-native';
import { Platform } from '@symbiote-native/vue';
import { createApp } from '@symbiote-native/vue/bootstrap';
import { createLayoutProbe } from './common';
const probe = TurboModuleRegistry.getEnforcing('SymbioteFabricProbe');
const App = {
  setup() {
    const width = ref(120);
    const value = ref('seed');
    const onLayout = createLayoutProbe(
      'Vue',
      Platform,
      () => {
        width.value = 240;
      },
      probe,
    );
    return () =>
      h('view', null, [
        h(
          'view',
          {
            onLayout,
            style: {
              width: width.value,
              height: 80,
              backgroundColor: '#234567',
            },
          },
          [h('text', null, 'Windows Vue')],
        ),
        h('text-input', {
          testID: 'windows-input',
          value: value.value,
          onChange: event => {
            value.value = event.nativeEvent.text.toUpperCase();
          },
          style: { width: 240, height: 40 },
        }),
      ]);
  },
};
createApp(App, { debug: true }).mount('SymbioteFabricProbe');
