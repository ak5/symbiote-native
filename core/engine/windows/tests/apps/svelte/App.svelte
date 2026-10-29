<script>
  import { TurboModuleRegistry } from 'react-native';
  import { Platform, useWindowDimensions } from '@symbiote-native/svelte';
  import { createLayoutProbe, viewportLabel } from './common';
  const metrics = useWindowDimensions();
  let width = $state(120);
  let value = $state('seed');
  const probe = TurboModuleRegistry.getEnforcing('SymbioteFabricProbe');
  const onLayout = createLayoutProbe(
    'Svelte',
    Platform,
    () => {
      width = 240;
    },
    probe,
  );
</script>

<safe-area-view>
  <view {onLayout} style={{ width, height: 80, backgroundColor: '#234567' }}>
    <text>Windows Svelte</text>
  </view>
  <text-input
    testID="windows-input"
    {value}
    onChange={event => {
      value = event.nativeEvent.text.toUpperCase();
    }}
    style={{ width: 240, height: 40 }}
  />
  <text
    testID="windows-metrics"
    accessibilityLabel={viewportLabel(metrics.current)}
    style={{ color: '#111111', backgroundColor: '#ffffff' }}
  >
    {viewportLabel(metrics.current)}
  </text>
</safe-area-view>
