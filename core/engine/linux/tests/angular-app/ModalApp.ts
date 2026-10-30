import { Component, signal } from '@angular/core';
import {
  Modal,
  SYMBIOTE_ELEMENTS,
  type IModalAnimationType,
} from '@symbiote-native/angular';
import {
  modalModes,
  pageStyle,
  clipStyle,
  cardStyle,
  buttonStyle,
  fieldStyle,
  textStyle,
  modalLifecycle,
  reloadModalRuntime,
} from './modal-fixture';

@Component({
  selector: 'symbiote-linux-modal-app',
  standalone: true,
  imports: [SYMBIOTE_ELEMENTS, Modal],
  template: `
    <view [style]="pageStyle">
      <text-input
        [accessible]="true"
        accessibilityLabel="Modal background"
        [style]="fieldStyle"
        [value]="background()"
        [onValueChange]="onBackgroundChange"
      />
      <pressable
        [accessible]="true"
        accessibilityRole="button"
        accessibilityLabel="Background action"
        [style]="buttonStyle"
        [onPress]="onBackgroundAction"
      >
        <text [style]="textStyle">Background action</text>
      </pressable>
      @for (animation of modes; track animation) {
        <pressable
          [accessible]="true"
          accessibilityRole="button"
          [accessibilityLabel]="'Open ' + animation + ' modal'"
          [style]="buttonStyle"
          [onPress]="openers[animation]"
        >
          <text [style]="textStyle">Open {{ animation }} modal</text>
        </pressable>
      }
      <text [style]="textStyle"
        >Background count {{ backgroundActions() }}</text
      >
      <text [style]="textStyle">{{
        lifecycle(shown(), dismissed(), requested(), nestedClosed())
      }}</text>
      <text [style]="textStyle">Background draft: {{ background() }}</text>
      <view [style]="clipStyle">
        <Modal
          [visible]="visible()"
          [animationType]="mode()"
          [transparent]="mode() === 'slide'"
          accessibilityLabel="Native modal"
          (show)="onShow()"
          (dismiss)="onDismiss()"
          (requestClose)="onRequestClose()"
        >
          <view [style]="cardStyle">
            <text-input
              [accessible]="true"
              accessibilityLabel="Modal editor"
              [style]="fieldStyle"
              [value]="value()"
              [onValueChange]="onValueChange"
            />
            <text [style]="textStyle">Modal draft: {{ value() }}</text>
            <text [style]="textStyle">Modal shown count {{ shown() }}</text>
            <pressable
              [accessible]="true"
              accessibilityRole="button"
              accessibilityLabel="Open nested modal"
              [style]="buttonStyle"
              [onPress]="onNestedOpen"
            >
              <text [style]="textStyle">Open nested modal</text>
            </pressable>
            <pressable
              [accessible]="true"
              accessibilityRole="button"
              accessibilityLabel="Reload modal runtime"
              [style]="buttonStyle"
              [onPress]="reload"
            >
              <text [style]="textStyle">Reload modal runtime</text>
            </pressable>
            <Modal
              [visible]="nested()"
              animationType="fade"
              accessibilityLabel="Native nested modal"
              (requestClose)="onNestedClose()"
              (dismiss)="onNestedDismiss()"
            >
              <view [style]="cardStyle">
                <text-input
                  [accessible]="true"
                  accessibilityLabel="Nested editor"
                  [style]="fieldStyle"
                  [value]="nestedValue()"
                  [onValueChange]="onNestedValueChange"
                />
              </view>
            </Modal>
          </view>
        </Modal>
      </view>
    </view>
  `,
})
export class ModalApp {
  readonly pageStyle = pageStyle;
  readonly clipStyle = clipStyle;
  readonly cardStyle = cardStyle;
  readonly buttonStyle = buttonStyle;
  readonly fieldStyle = fieldStyle;
  readonly textStyle = textStyle;
  readonly modes = modalModes;
  readonly lifecycle = modalLifecycle;
  readonly reload = reloadModalRuntime;
  readonly mode = signal<IModalAnimationType>('none');
  readonly visible = signal(false);
  readonly nested = signal(false);
  readonly background = signal('a雪b');
  readonly value = signal('');
  readonly nestedValue = signal('');
  readonly shown = signal(0);
  readonly dismissed = signal(0);
  readonly requested = signal(0);
  readonly nestedClosed = signal(0);
  readonly backgroundActions = signal(0);
  readonly openers = {
    none: () => this.open('none'),
    fade: () => this.open('fade'),
    slide: () => this.open('slide'),
  };
  readonly onBackgroundChange = (event: { text: string }) =>
    this.background.set(event.text);
  readonly onValueChange = (event: { text: string }) =>
    this.value.set(event.text);
  readonly onNestedValueChange = (event: { text: string }) =>
    this.nestedValue.set(event.text);
  readonly onBackgroundAction = () =>
    this.backgroundActions.update(count => count + 1);
  readonly onShow = () => this.shown.update(count => count + 1);
  readonly onDismiss = () => this.dismissed.update(count => count + 1);
  readonly onRequestClose = () => {
    this.requested.update(count => count + 1);
    this.visible.set(false);
  };
  readonly onNestedOpen = () => {
    this.nestedValue.set('');
    this.nested.set(true);
  };
  readonly onNestedClose = () => this.nested.set(false);
  readonly onNestedDismiss = () => this.nestedClosed.update(count => count + 1);
  private open(animation: IModalAnimationType): void {
    this.mode.set(animation);
    this.value.set('');
    this.nested.set(false);
    this.visible.set(true);
  }
}
