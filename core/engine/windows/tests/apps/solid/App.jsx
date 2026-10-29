import { createSignal } from 'solid-js';
import { TurboModuleRegistry } from 'react-native';
import { Platform, createWindowDimensions } from '@symbiote-native/solid';
import { createLayoutProbe, viewportLabel } from './common';
export default function App() {
  const metrics = createWindowDimensions();
  const [width, setWidth] = createSignal(120);
  const [value, setValue] = createSignal('seed');
  const probe = TurboModuleRegistry.getEnforcing('SymbioteFabricProbe');
  const onLayout = createLayoutProbe(
    'Solid',
    Platform,
    () => setWidth(240),
    probe,
  );
  return (
    <safe-area-view>
      <view
        onLayout={onLayout}
        style={{ width: width(), height: 80, backgroundColor: '#234567' }}
      >
        <text>Windows Solid</text>
      </view>
      <text-input
        testID="windows-input"
        value={value()}
        onChange={event => setValue(event.nativeEvent.text.toUpperCase())}
        style={{ width: 240, height: 40 }}
      />
      <text
        testID="windows-metrics"
        accessibilityLabel={viewportLabel(metrics())}
        style={{ color: '#111111', backgroundColor: '#ffffff' }}
      >
        {viewportLabel(metrics())}
      </text>
    </safe-area-view>
  );
}
