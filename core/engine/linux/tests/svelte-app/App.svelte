<script>
  import { dlog } from '@symbiote-native/engine';
  import { useWindowDimensions } from '@symbiote-native/svelte';
  import { reportScroll } from './scroll-probe';

  const metrics = useWindowDimensions();
  let width = $state(120);
  let value = $state('');
  $effect(() => {
    if (!globalThis.__symbioteEngineNative) {
      throw new Error('The packaged app did not initialize the C++ engine');
    }
    if (width === 120) width = 240;
    else dlog('Symbiote Linux Svelte app updated');
  });
  $effect(() => {
    dlog(
      `Symbiote Linux window: ${metrics.current.width}x${metrics.current.height}`,
    );
  });
</script>

<safe-area-view style={{ width: 240 }}>
  <view style={{ width, height: 80, backgroundColor: '#234567' }}>
    <text onFocus={() => dlog('Symbiote Linux focus: heading')}>
      Symbiote Linux
    </text>
    <text-input
      {value}
      accessibilityLabel="Desktop input"
      onFocus={() => dlog('Symbiote Linux focus: input')}
      style={{ width: 220, height: 40, color: '#ffffff' }}
      onValueChange={event => {
        value = event.text;
        dlog(`Symbiote Linux input: ${event.text}`);
      }}
    />
    <text>{metrics.current.width}x{metrics.current.height}</text>
  </view>
  <scroll-view
    onScroll={reportScroll}
    scrollEventThrottle={16}
    style={{ width: 240, height: 200 }}
  >
    {#each Array.from({ length: 40 }, (_, row) => row) as row (row)}
      <text style={{ height: 30 }}>{`Scroll row ${row}`}</text>
    {/each}
  </scroll-view>
</safe-area-view>
