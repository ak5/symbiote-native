import { Component, signal } from '@angular/core';
import type { ISymbioteEvent } from '@symbiote-native/engine';
import { TurboModuleRegistry } from 'react-native';
import { Platform, SYMBIOTE_ELEMENTS } from '@symbiote-native/angular';
import { createLayoutProbe, type IProbe } from '../common';
@Component({
  selector: 'symbiote-windows-app',
  standalone: true,
  imports: [SYMBIOTE_ELEMENTS],
  template: `<view
    ><view
      [onLayout]="onLayout"
      [style]="{ width: width(), height: 80, backgroundColor: '#234567' }"
      ><text>Windows Angular</text></view
    ><text-input
      testID="windows-input"
      [value]="value()"
      [onChangeText]="onChange"
      [style]="{ width: 240, height: 40 }"
  /></view>`,
})
export class App {
  readonly width = signal(120);
  readonly value = signal('seed');
  readonly onChange = (event: ISymbioteEvent) => {
    const text = event.nativeEvent.text;
    if (typeof text !== 'string') throw new Error('Missing native input text');
    this.value.set(text.toUpperCase());
  };
  readonly onLayout = createLayoutProbe(
    'Angular',
    Platform,
    () => this.width.set(240),
    TurboModuleRegistry.getEnforcing<IProbe>('SymbioteFabricProbe'),
  );
}
