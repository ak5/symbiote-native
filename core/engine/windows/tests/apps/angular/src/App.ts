import { Component, signal, inject } from '@angular/core';
import type { ISymbioteEvent } from '@symbiote-native/engine';
import { TurboModuleRegistry } from 'react-native';
import {
  Platform,
  SYMBIOTE_ELEMENTS,
  WindowDimensionsService,
} from '@symbiote-native/angular';
import {
  createLayoutProbe,
  createScrollProbe,
  scrollRows,
  viewportLabel,
  type IProbe,
} from '../common';
@Component({
  selector: 'symbiote-windows-app',
  standalone: true,
  imports: [SYMBIOTE_ELEMENTS],
  template: `<safe-area-view
    ><view
      [onLayout]="onLayout"
      [style]="{ width: width(), height: 80, backgroundColor: '#234567' }"
      ><text>Windows Angular</text></view
    ><text-input
      testID="windows-input"
      [value]="value()"
      [onChangeText]="onChange"
      [style]="{ width: 240, height: 40 }"
    /><text
      testID="windows-metrics"
      [accessibilityLabel]="viewportLabel(metrics())"
      [style]="{ color: '#111111', backgroundColor: '#ffffff' }"
      >{{ viewportLabel(metrics()) }}</text
    ><scroll-view
      testID="windows-scroll"
      [onScroll]="onScroll"
      [scrollEventThrottle]="16"
      [style]="{ width: 240, height: 200 }"
    >
      @for (row of scrollRows; track row) {
        <text [style]="{ height: 30 }">Scroll row {{ row }}</text>
      }
    </scroll-view></safe-area-view
  >`,
})
export class App {
  readonly scrollRows = scrollRows;
  readonly onScroll = createScrollProbe(
    'Angular',
    TurboModuleRegistry.getEnforcing<IProbe>('SymbioteFabricProbe'),
  );
  readonly metrics = inject(WindowDimensionsService).dimensions;
  readonly viewportLabel = viewportLabel;
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
