import { createElement, useMemo, useState } from 'react';
import { TurboModuleRegistry } from 'react-native';
import { Platform } from '@symbiote-native/react';
import { registerApp } from '@symbiote-native/react/bootstrap';
import { createLayoutProbe } from './common';
const probe = TurboModuleRegistry.getEnforcing('SymbioteFabricProbe');
function App() {
  const [width, setWidth] = useState(120);
  const onLayout = useMemo(
    () => createLayoutProbe('React', Platform, () => setWidth(240), probe),
    [],
  );
  return createElement(
    'view',
    { onLayout, style: { width, height: 80, backgroundColor: '#234567' } },
    createElement('text', null, 'Windows React'),
  );
}
registerApp(App, { appName: 'SymbioteFabricProbe', debug: true });
