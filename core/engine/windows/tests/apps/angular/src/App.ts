import { Component, signal } from '@angular/core';
import { TurboModuleRegistry } from 'react-native';
import { Platform, SYMBIOTE_ELEMENTS } from '@symbiote-native/angular';
import { createLayoutProbe, type IProbe } from '../common';
@Component({
  selector: 'symbiote-windows-app',
  standalone: true,
  imports: [SYMBIOTE_ELEMENTS],
  template: `<view
    [onLayout]="onLayout"
    [style]="{ width: width(), height: 80, backgroundColor: '#234567' }"
    ><text>Windows Angular</text></view
  >`,
})
export class App {
  readonly width = signal(120);
  readonly onLayout = createLayoutProbe(
    'Angular',
    Platform,
    () => this.width.set(240),
    TurboModuleRegistry.getEnforcing<IProbe>('SymbioteFabricProbe'),
  );
}
