import { verifyEngine } from '../../../windows/tests/engine-smoke.js';
import { describe, it, report } from './harness';

describe('Windows production engine runtime fixture', () => {
  it('commits and measures both widths through the shared mutation buffer', () => {
    verifyEngine(1, globalThis.__symbioteEngineNative);
  });
});
report();
