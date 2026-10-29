import { createSignal, createEffect, onMount } from 'solid-js';
import { createWindowDimensions } from '@symbiote-native/solid';
import { dlog } from '@symbiote-native/engine';
import { reportScroll } from './scroll-probe';

export default function App() {
  const [width, setWidth] = createSignal(120);
  const [value, setValue] = createSignal('');
  const metrics = createWindowDimensions();
  createEffect(() =>
    dlog(`Symbiote Linux window: ${metrics().width}x${metrics().height}`),
  );
  onMount(() => {
    if (!globalThis.__symbioteEngineNative)
      throw new Error('The packaged app did not initialize the C++ engine');
    setWidth(240);
    queueMicrotask(() => dlog('Symbiote Linux Solid app updated'));
  });
  return (
    <safe-area-view style={{ width: 240 }}>
      <view style={{ width: width(), height: 80, backgroundColor: '#234567' }}>
        <text onFocus={() => dlog('Symbiote Linux focus: heading')}>
          Symbiote Linux
        </text>
        <text-input
          value={value()}
          accessibilityLabel="Desktop input"
          style={{ width: 220, height: 40, color: '#ffffff' }}
          onFocus={() => dlog('Symbiote Linux focus: input')}
          onValueChange={event => {
            setValue(event.text);
            dlog(`Symbiote Linux input: ${event.text}`);
          }}
        />
        <text>
          {metrics().width}x{metrics().height}
        </text>
      </view>
      <scroll-view
        onScroll={reportScroll}
        scrollEventThrottle={16}
        style={{ width: 240, height: 200 }}
      >
        {Array.from({ length: 40 }, (_, row) => (
          <text style={{ height: 30 }}>{`Scroll row ${row}`}</text>
        ))}
      </scroll-view>
    </safe-area-view>
  );
}
