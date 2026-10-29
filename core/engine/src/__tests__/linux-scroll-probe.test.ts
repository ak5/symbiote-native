import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ISymbioteEvent } from '../node-types';
import { dlog } from '@symbiote-native/engine';
import { reportScroll } from '../../linux/tests/scroll-probe.js';

vi.mock('@symbiote-native/engine', () => ({ dlog: vi.fn() }));
beforeEach(() => vi.mocked(dlog).mockClear());

function scroll(y: number): ISymbioteEvent {
  return { nativeEvent: { contentOffset: { y } } } as ISymbioteEvent;
}

describe('Linux native scroll probe', () => {
  it('requires a positive native offset beyond the initial viewport', () => {
    reportScroll(scroll(0));
    reportScroll(scroll(199));
    expect(dlog).not.toHaveBeenCalled();
    reportScroll(scroll(200));
    expect(dlog).toHaveBeenCalledWith('Symbiote Linux scroll: passed 200');
  });

  it('rejects missing or non-finite native offsets', () => {
    expect(() => reportScroll({} as ISymbioteEvent)).toThrow(/vertical offset/);
    for (const y of [NaN, Infinity, -Infinity])
      expect(() => reportScroll(scroll(y))).toThrow(/vertical offset/);
    expect(dlog).not.toHaveBeenCalled();
  });
});
