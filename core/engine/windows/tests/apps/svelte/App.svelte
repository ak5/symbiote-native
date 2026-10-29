<script>
  import { TurboModuleRegistry } from 'react-native';
  import { Platform } from '@symbiote-native/svelte';
  import { createLayoutProbe } from './common';
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

<view>
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
</view>
