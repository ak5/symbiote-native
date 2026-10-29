import { createElement, useEffect, useState } from 'react';
import { AppRegistry as NativeAppRegistry } from 'react-native';
import { Platform, Text, View } from '@symbiote-native/react';
import { registerApp } from '@symbiote-native/react/bootstrap';
import { dlog } from '@symbiote-native/engine';

if (
  Platform.OS !== 'linux' ||
  Platform.constants.reactNativeVersion.minor !== 87
) {
  throw new Error('The packaged app did not resolve the native Linux Platform');
}
if (Platform.select({ linux: 'linux', native: 'native' }) !== 'linux') {
  throw new Error('The packaged app did not select Linux');
}

function App() {
  const [width, setWidth] = useState(120);
  useEffect(() => {
    if (!globalThis.__symbioteEngineNative) {
      throw new Error('The packaged app did not initialize the C++ engine');
    }
    if (width === 120) setWidth(240);
    else dlog('Symbiote Linux React app updated');
  }, [width]);
  return createElement(
    View,
    { style: { width, height: 80, backgroundColor: '#234567' } },
    createElement(Text, null, 'Symbiote Linux'),
  );
}

registerApp(App, { appName: 'SymbioteLinux', debug: true });
NativeAppRegistry.runApplication('SymbioteLinux', {
  initialProps: {},
  rootTag: 1,
});
