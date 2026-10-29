import { createSignal } from 'solid-js';
import { TurboModuleRegistry } from 'react-native';
import { Platform } from '@symbiote-native/solid';
import { createLayoutProbe } from './common';
export default function App() {
  const [width, setWidth] = createSignal(120);
  const probe = TurboModuleRegistry.getEnforcing('SymbioteFabricProbe');
  const onLayout = createLayoutProbe(
    'Solid',
    Platform,
    () => setWidth(240),
    probe,
  );
  return (
    <view
      onLayout={onLayout}
      style={{ width: width(), height: 80, backgroundColor: '#234567' }}
    >
      <text>Windows Solid</text>
    </view>
  );
}
