import {
  nativeEngine,
  SUPPORTED_NATIVE_VERSION,
} from '../../src/native-engine';
import { getNativeModule } from '../../src/native-modules';
import {
  recordAppendChild,
  recordCommit,
  recordCreateAnchor,
  recordCreateElement,
  recordSetProp,
  takeBatch,
} from '../../src/mutation-buffer';

const engine = nativeEngine();
if (!engine || engine.version !== SUPPORTED_NATIVE_VERSION) {
  throw new Error('Linux did not initialize the native engine');
}
if (engine.probeUIManager() < 1) {
  throw new Error('Linux did not expose a live Fabric surface');
}

const root = { slot: -1, slotBatch: -1, createdBatch: -1 };
const view = { slot: -1, slotBatch: -1, createdBatch: -1 };
recordCreateAnchor(root);
recordCreateElement(view, 'View', false, {});
recordSetProp(view, 'width', 120);
recordSetProp(view, 'height', 80);
recordSetProp(view, 'backgroundColor', 0xff3366cc | 0);
recordAppendChild(root, view);
recordCommit(1, root);
let batch = takeBatch();
engine.applyOps(
  batch.ops,
  batch.strings,
  batch.values,
  batch.instanceHandles,
  batch.handles,
);
if (engine.committedPayloadOf(view).width !== 120) {
  throw new Error('The Linux engine did not commit the initial view');
}

recordSetProp(view, 'width', 240);
recordCommit(1, root);
batch = takeBatch();
engine.applyOps(
  batch.ops,
  batch.strings,
  batch.values,
  batch.instanceHandles,
  batch.handles,
);
if (engine.committedPayloadOf(view).width !== 240) {
  throw new Error('The Linux engine did not commit the changed view');
}
if (nativeEngine() !== engine) {
  throw new Error('Native engine resolution replaced the live bindings');
}
const module = getNativeModule<{ getVersion(): number }>('SymbioteEngine');
if (
  module?.getVersion() !== SUPPORTED_NATIVE_VERSION ||
  globalThis.__symbioteEngineNative !== engine
) {
  throw new Error('A repeated native version probe replaced the live bindings');
}
console.log('Symbiote Linux engine smoke passed');
