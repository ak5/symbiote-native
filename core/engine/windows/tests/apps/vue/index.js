import { h, ref } from 'vue';
import { TurboModuleRegistry } from 'react-native';
import { Platform, useWindowDimensions } from '@symbiote-native/vue';
import { createApp } from '@symbiote-native/vue/bootstrap';
import {
  createLayoutProbe,
  createScrollProbe,
  scrollRows,
  viewportLabel,
} from './common';
const probe = TurboModuleRegistry.getEnforcing('SymbioteFabricProbe');
const App = {
  setup() {
    const metrics = useWindowDimensions();
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
    const onScroll = createScrollProbe('Vue', probe);
    return () =>
      h('safe-area-view', null, [
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
        h(
          'text',
          {
            testID: 'windows-metrics',
            accessibilityLabel: viewportLabel(metrics.value),
            style: { color: '#111111', backgroundColor: '#ffffff' },
          },
          viewportLabel(metrics.value),
        ),
        h(
          'scroll-view',
          {
            testID: 'windows-scroll',
            accessible: true,
            accessibilityRole: 'list',
            accessibilityLabel: 'Scrollable rows',
            onScroll,
            scrollEventThrottle: 16,
            style: { width: 240, height: 200 },
          },
          scrollRows.map(row =>
            h('text', { key: row, style: { height: 30 } }, `Scroll row ${row}`),
          ),
        ),
      ]);
  },
};
createApp(App, { debug: true }).mount('SymbioteFabricProbe');
