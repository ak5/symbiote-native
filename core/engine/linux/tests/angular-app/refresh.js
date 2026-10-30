import { AppRegistry } from 'react-native';
import { Platform } from '@symbiote-native/angular';
import { bootstrapApplication } from '@symbiote-native/angular/bootstrap';
import { RefreshApp } from './build/RefreshApp';

if (
  Platform.OS !== 'linux' ||
  Platform.constants?.reactNativeVersion.minor !== 87 ||
  Platform.select({ linux: 'linux', native: 'native' }) !== 'linux'
) {
  throw new Error('The packaged app did not resolve the native Linux Platform');
}
bootstrapApplication(RefreshApp, {
  appName: 'SymbioteLinuxRefresh',
  debug: true,
});
AppRegistry.runApplication('SymbioteLinuxRefresh', {
  initialProps: {},
  rootTag: 1,
});
if (!globalThis.__symbioteEngineNative)
  throw new Error('The packaged app did not initialize the C++ engine');
