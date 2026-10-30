import { AppRegistry } from 'react-native';
import { Platform } from '@symbiote-native/angular';
import { bootstrapApplication } from '@symbiote-native/angular/bootstrap';
import { ModalApp } from './build/ModalApp';

if (
  Platform.OS !== 'linux' ||
  Platform.constants?.reactNativeVersion.minor !== 87 ||
  Platform.select({ linux: 'linux', native: 'native' }) !== 'linux'
) {
  throw new Error('The packaged app did not resolve the native Linux Platform');
}
bootstrapApplication(ModalApp, { appName: 'SymbioteLinuxModal', debug: true });
AppRegistry.runApplication('SymbioteLinuxModal', {
  initialProps: {},
  rootTag: 1,
});
if (!globalThis.__symbioteEngineNative)
  throw new Error('The packaged app did not initialize the C++ engine');
