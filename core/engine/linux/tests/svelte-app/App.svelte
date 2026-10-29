<script>
  import { dlog } from '@symbiote-native/engine';

  let width = $state(120);
  let value = $state('');
  $effect(() => {
    if (!globalThis.__symbioteEngineNative) {
      throw new Error('The packaged app did not initialize the C++ engine');
    }
    if (width === 120) width = 240;
    else dlog('Symbiote Linux Svelte app updated');
  });
</script>

<view style={{ width, height: 80, backgroundColor: '#234567' }}>
  <text>Symbiote Linux</text>
  <text-input
    {value}
    accessibilityLabel="Desktop input"
    style={{ width: 220, height: 40, color: '#ffffff' }}
    onValueChange={event => {
      value = event.text;
      dlog(`Symbiote Linux input: ${event.text}`);
    }}
  />
</view>
