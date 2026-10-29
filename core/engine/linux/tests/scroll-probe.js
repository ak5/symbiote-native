import { dlog } from '@symbiote-native/engine';

export function reportScroll(event) {
  const offset = event?.nativeEvent?.contentOffset?.y;
  if (typeof offset !== 'number' || !Number.isFinite(offset))
    throw new Error('Native scroll event has no vertical offset');
  if (offset >= 200) dlog('Symbiote Linux scroll: passed 200');
}
