import { AppRegistry as NativeAppRegistry } from 'react-native';
import { Platform } from '@symbiote-native/svelte';
import { createApp } from '@symbiote-native/svelte/bootstrap';
import RefreshApp from './RefreshApp.svelte';

if (
  Platform.OS !== 'linux' ||
  Platform.constants?.reactNativeVersion.minor !== 87 ||
  Platform.select({ linux: 'linux', native: 'native' }) !== 'linux'
) {
  throw new Error('The packaged app did not resolve the native Linux Platform');
}

createApp(RefreshApp, { debug: true }).mount('SymbioteLinuxRefresh');
NativeAppRegistry.runApplication('SymbioteLinuxRefresh', {
  initialProps: {},
  rootTag: 1,
});
