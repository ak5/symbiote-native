import { createElement, useMemo, useState } from 'react';
import { TurboModuleRegistry } from 'react-native';
import { Platform, useWindowDimensions } from '@symbiote-native/react';
import { registerApp } from '@symbiote-native/react/bootstrap';
import {
  createLayoutProbe,
  createScrollProbe,
  scrollRows,
  viewportLabel,
} from './common';
const probe = TurboModuleRegistry.getEnforcing('SymbioteFabricProbe');
function App() {
  const metrics = useWindowDimensions();
  const [width, setWidth] = useState(120);
  const [value, setValue] = useState('seed');
  const onLayout = useMemo(
    () => createLayoutProbe('React', Platform, () => setWidth(240), probe),
    [],
  );
  const onScroll = useMemo(() => createScrollProbe('React', probe), []);
  return createElement(
    'safe-area-view',
    null,
    createElement(
      'view',
      { onLayout, style: { width, height: 80, backgroundColor: '#234567' } },
      createElement('text', null, 'Windows React'),
    ),
    createElement('text-input', {
      testID: 'windows-input',
      value,
      onChange: event => setValue(event.nativeEvent.text.toUpperCase()),
      style: { width: 240, height: 40 },
    }),
    createElement(
      'text',
      {
        testID: 'windows-metrics',
        accessibilityLabel: viewportLabel(metrics),
        style: { color: '#111111', backgroundColor: '#ffffff' },
      },
      viewportLabel(metrics),
    ),
    createElement(
      'scroll-view',
      {
        testID: 'windows-scroll',
        onScroll,
        scrollEventThrottle: 16,
        style: { width: 240, height: 200 },
      },
      scrollRows.map(row =>
        createElement(
          'text',
          { key: row, style: { height: 30 } },
          `Scroll row ${row}`,
        ),
      ),
    ),
  );
}
registerApp(App, { appName: 'SymbioteFabricProbe', debug: true });
