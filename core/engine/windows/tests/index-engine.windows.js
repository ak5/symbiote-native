import { AppRegistry, TurboModuleRegistry } from 'react-native';
import { verifyEngine } from './engine-smoke';

AppRegistry.registerRunnable('SymbioteFabricProbe', ({ rootTag }) => {
  const probe = TurboModuleRegistry.getEnforcing('SymbioteFabricProbe');
  try {
    const module = TurboModuleRegistry.getEnforcing('SymbioteEngine');
    if (module.getVersion() !== 4)
      throw new Error('Unexpected native module version');
    const engine = globalThis.__symbioteEngineNative;
    verifyEngine(rootTag, engine);
    TurboModuleRegistry.getEnforcing('SymbioteEngine').getVersion();
    if (globalThis.__symbioteEngineNative !== engine)
      throw new Error('Lookup replaced live bindings');
    probe.run(rootTag);
  } catch (error) {
    probe.reportFailure(String(error?.stack ?? error));
    throw error;
  }
});
