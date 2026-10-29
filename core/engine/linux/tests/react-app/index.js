import { createElement, useEffect, useState } from 'react';
import { AppRegistry as NativeAppRegistry } from 'react-native';
import { Platform, useWindowDimensions } from '@symbiote-native/react';
import { registerApp } from '@symbiote-native/react/bootstrap';
import { dlog } from '@symbiote-native/engine';
import { reportScroll } from './scroll-probe';

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
  const metrics = useWindowDimensions();
  const [width, setWidth] = useState(120);
  const [value, setValue] = useState('');
  /** @type {import('@symbiote-native/react').ITextInputProps} */
  const inputProps = {
    value,
    accessibilityLabel: 'Desktop input',
    onFocus: () => dlog('Symbiote Linux focus: input'),
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
  useEffect(() => {
    dlog(`Symbiote Linux window: ${metrics.width}x${metrics.height}`);
  }, [metrics.width, metrics.height]);
  return createElement(
    'view',
    { style: { width: 240 } },
    createElement(
      'view',
      { style: { width, height: 80, backgroundColor: '#234567' } },
      createElement(
        'text',
        { onFocus: () => dlog('Symbiote Linux focus: heading') },
        'Symbiote Linux',
      ),
      createElement('text-input', inputProps),
      createElement('text', null, `${metrics.width}x${metrics.height}`),
    ),
    createElement(
      'scroll-view',
      {
        onScroll: reportScroll,
        scrollEventThrottle: 16,
        style: { width: 240, height: 200 },
      },
      Array.from({ length: 40 }, (_, row) =>
        createElement(
          'text',
          { key: row, style: { height: 30 } },
          `Scroll row ${row}`,
        ),
      ),
    ),
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
