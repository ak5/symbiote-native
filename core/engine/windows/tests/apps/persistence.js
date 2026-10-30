import AsyncStorage from '@react-native-async-storage/async-storage';
import { TurboModuleRegistry } from 'react-native';

// Test-only seam for the fresh-process persistence runner.
globalThis.__symbiotePersistenceProbe = {
  storage: AsyncStorage,
  native: TurboModuleRegistry.getEnforcing('SymbioteFabricProbe'),
};
