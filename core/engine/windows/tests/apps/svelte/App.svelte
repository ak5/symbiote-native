<script>
  import { TurboModuleRegistry } from 'react-native';
  import { Platform } from '@symbiote-native/svelte';
  import { createLayoutProbe } from './common';
  let width = $state(120);
  const probe = TurboModuleRegistry.getEnforcing('SymbioteFabricProbe');
  const onLayout = createLayoutProbe('Svelte', Platform, () => { width = 240; }, probe);
</script>
<view {onLayout} style={{ width, height: 80, backgroundColor: '#234567' }}>
  <text>Windows Svelte</text>
</view>
