import { createElement, useEffect, useState } from 'react';
import { AppRegistry as NativeAppRegistry } from 'react-native';
import { Platform } from '@symbiote-native/react';
import { registerApp } from '@symbiote-native/react/bootstrap';
import { dlog } from '@symbiote-native/engine';

if (
  Platform.OS !== 'linux' ||
  Platform.constants?.reactNativeVersion.minor !== 87
) {
  throw new Error('The packaged app did not resolve the native Linux Platform');
}
if (Platform.select({ linux: 'linux', native: 'native' }) !== 'linux') {
  throw new Error('The packaged app did not select Linux');
}

function App() {
  const [width, setWidth] = useState(120);
  const [value, setValue] = useState('');
  /** @type {import('@symbiote-native/react').ITextInputProps} */
  const inputProps = {
    value,
    accessibilityLabel: 'Desktop input',
    style: { width: 220, height: 40, color: '#ffffff' },
    onValueChange: event => {
      setValue(event.text);
      dlog(`Symbiote Linux input: ${event.text}`);
    },
  };
  useEffect(() => {
    if (!globalThis.__symbioteEngineNative) {
      throw new Error('The packaged app did not initialize the C++ engine');
    }
    if (width === 120) setWidth(240);
    else dlog('Symbiote Linux React app updated');
  }, [width]);
  return createElement(
    'view',
    { style: { width, height: 80, backgroundColor: '#234567' } },
    createElement('text', null, 'Symbiote Linux'),
    createElement('text-input', inputProps),
  );
}

registerApp(App, { appName: 'SymbioteLinux', debug: true });
NativeAppRegistry.runApplication('SymbioteLinux', {
  initialProps: {},
  // The native host creates numeric surface 1; RN's generated type is opaque.
  rootTag: /** @type {import('react-native').RootTag} */ (
    /** @type {unknown} */ (1)
  ),
});
