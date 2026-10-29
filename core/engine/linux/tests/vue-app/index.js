import { h, ref, onMounted, nextTick, watchEffect } from 'vue';
import { AppRegistry } from 'react-native';
import { Platform, useWindowDimensions } from '@symbiote-native/vue';
import { createApp } from '@symbiote-native/vue/bootstrap';
import { dlog } from '@symbiote-native/engine';

if (
  Platform.OS !== 'linux' ||
  Platform.constants?.reactNativeVersion.minor !== 87 ||
  Platform.select({ linux: 'linux', native: 'native' }) !== 'linux'
) {
  throw new Error('The packaged app did not resolve the native Linux Platform');
}
const App = {
  setup() {
    let view;
    const width = ref(120);
    const value = ref('');
    const metrics = useWindowDimensions();
    watchEffect(() =>
      dlog(
        `Symbiote Linux window: ${metrics.value.width}x${metrics.value.height}`,
      ),
    );
    onMounted(async () => {
      if (!globalThis.__symbioteEngineNative)
        throw new Error('The packaged app did not initialize the C++ engine');
      width.value = 240;
      await nextTick();
      if (!view) throw new Error('The native view ref was not attached');
      view.measure((_x, _y, measuredWidth, height) => {
        if (measuredWidth !== 240 || height !== 80)
          throw new Error('Vue update did not reach native layout');
        dlog('Symbiote Linux Vue app updated');
      });
    });
    return () =>
      h(
        'view',
        {
          ref: instance => {
            view = instance;
          },
          style: { width: width.value, height: 80, backgroundColor: '#234567' },
        },
        [
          h(
            'text',
            { onFocus: () => dlog('Symbiote Linux focus: heading') },
            'Symbiote Linux',
          ),
          h('text-input', {
            value: value.value,
            accessibilityLabel: 'Desktop input',
            style: { width: 220, height: 40, color: '#ffffff' },
            onFocus: () => dlog('Symbiote Linux focus: input'),
            onValueChange: event => {
              value.value = event.text;
              dlog(`Symbiote Linux input: ${event.text}`);
            },
          }),
          h('text', null, `${metrics.value.width}x${metrics.value.height}`),
        ],
      );
  },
};
createApp(App, { debug: true }).mount('SymbioteLinux');
AppRegistry.runApplication('SymbioteLinux', { initialProps: {}, rootTag: 1 });
