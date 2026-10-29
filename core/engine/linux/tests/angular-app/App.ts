import {
  Component,
  AfterViewInit,
  signal,
  effect,
  inject,
} from '@angular/core';
import {
  SYMBIOTE_ELEMENTS,
  WindowDimensionsService,
} from '@symbiote-native/angular';
import { dlog } from '@symbiote-native/engine';
import { reportScroll } from './scroll-probe';

@Component({
  selector: 'symbiote-linux-app',
  standalone: true,
  imports: [SYMBIOTE_ELEMENTS],
  template: `
    <safe-area-view [style]="{ width: 240 }">
      <view
        [style]="{ width: width(), height: 80, backgroundColor: '#234567' }"
      >
        <text [onFocus]="headingFocus">Symbiote Linux</text>
        <text-input
          [value]="value()"
          accessibilityLabel="Desktop input"
          [style]="{ width: 220, height: 40, color: '#ffffff' }"
          [onFocus]="inputFocus"
          [onValueChange]="inputChange"
        />
        <text>{{ dimensions().width }}x{{ dimensions().height }}</text>
      </view>
      <scroll-view
        [onScroll]="onScroll"
        [scrollEventThrottle]="16"
        [style]="{ width: 240, height: 200 }"
      >
        @for (row of rows; track row) {
          <text [style]="{ height: 30 }">Scroll row {{ row }}</text>
        }
      </scroll-view>
    </safe-area-view>
  `,
})
export class App implements AfterViewInit {
  readonly rows = Array.from({ length: 40 }, (_, row) => row);
  readonly onScroll = reportScroll;
  readonly width = signal(120);
  readonly value = signal('');
  readonly dimensions = inject(WindowDimensionsService).dimensions;
  readonly headingFocus = () => dlog('Symbiote Linux focus: heading');
  readonly inputFocus = () => dlog('Symbiote Linux focus: input');
  readonly inputChange = (event: { text: string }) => {
    this.value.set(event.text);
    dlog(`Symbiote Linux input: ${event.text}`);
  };
  constructor() {
    effect(() =>
      dlog(
        `Symbiote Linux window: ${this.dimensions().width}x${this.dimensions().height}`,
      ),
    );
    effect(() => {
      if (this.width() === 240) dlog('Symbiote Linux Angular app updated');
    });
  }
  ngAfterViewInit() {
    queueMicrotask(() => this.width.set(240));
  }
}
