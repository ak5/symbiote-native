import { AppRegistry, TurboModuleRegistry } from 'react-native';

AppRegistry.registerRunnable('SymbioteFabricProbe', ({ rootTag }) => {
  const probe = TurboModuleRegistry.getEnforcing('SymbioteFabricProbe');
  try {
    probe.run(rootTag);
  } catch (error) {
    probe.reportFailure(String(error?.stack ?? error));
    throw error;
  }
});
