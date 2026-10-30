import { AppRegistry as NativeAppRegistry } from 'react-native';
import { Platform } from '@symbiote-native/solid';
import { createApp } from '@symbiote-native/solid/bootstrap';
import ModalApp from './ModalApp';

if (
  Platform.OS !== 'linux' ||
  Platform.constants?.reactNativeVersion.minor !== 87 ||
  Platform.select({ linux: 'linux', native: 'native' }) !== 'linux'
) {
  throw new Error('The packaged app did not resolve the native Linux Platform');
}

createApp(ModalApp, { debug: true }).mount('SymbioteLinuxModal');
NativeAppRegistry.runApplication('SymbioteLinuxModal', {
  initialProps: {},
  rootTag: 1,
});
