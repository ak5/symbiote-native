import { Component, signal } from '@angular/core';
import { Modal, SYMBIOTE_ELEMENTS } from '@symbiote-native/angular';
import {
  pageStyle,
  buttonStyle,
  fieldStyle,
  textStyle,
  cardStyle,
  reloadModalRuntime,
} from './modal-fixture';
import {
  rowStyle,
  scrollStyle,
  contentStyle,
  controlsStyle,
  refreshProps,
  refreshStatus,
} from './refresh-fixture';

@Component({
  selector: 'symbiote-linux-refresh-app',
  standalone: true,
  imports: [SYMBIOTE_ELEMENTS, Modal],
  template: `
    <view [style]="pageStyle">
      <text [style]="textStyle">{{
        status(accept(), accepted(), rejected(), refreshing(), mounted())
      }}</text>
      <text-input
        [accessible]="true"
        accessibilityLabel="Refresh draft"
        [style]="fieldStyle"
        [value]="draft()"
        [onValueChange]="onDraftChange"
      />
      <text [style]="textStyle">Refresh draft value: {{ draft() }}</text>
      <view [style]="rowStyle">
        <scroll-view accessibilityLabel="Refresh scroll" [style]="scrollStyle">
          @if (mounted()) {
            <refresh-control
              [accessibilityLabel]="refreshProps.accessibilityLabel"
              [tintColor]="refreshProps.tintColor"
              [title]="refreshProps.title"
              [titleColor]="refreshProps.titleColor"
              [progressViewOffset]="refreshProps.progressViewOffset"
              [refreshing]="refreshing()"
              [onRefresh]="onRefresh"
            />
          }
          <view [style]="contentStyle"
            ><text [style]="textStyle">Library content</text></view
          >
        </scroll-view>
        <view [style]="controlsStyle">
          @for (action of actions; track action.label) {
            <pressable
              [accessible]="true"
              accessibilityRole="button"
              [accessibilityLabel]="action.label"
              [style]="buttonStyle"
              [onPress]="action.run"
              ><text [style]="textStyle">{{ action.label }}</text></pressable
            >
          }
        </view>
      </view>
      <Modal
        [visible]="modal()"
        animationType="none"
        accessibilityLabel="Refresh blocking modal"
        (requestClose)="modal.set(false)"
      >
        <view [style]="cardStyle"
          ><text [style]="textStyle">Refresh modal active</text></view
        >
      </Modal>
    </view>
  `,
})
export class RefreshApp {
  readonly pageStyle = pageStyle;
  readonly buttonStyle = buttonStyle;
  readonly fieldStyle = fieldStyle;
  readonly textStyle = textStyle;
  readonly cardStyle = cardStyle;
  readonly rowStyle = rowStyle;
  readonly scrollStyle = scrollStyle;
  readonly contentStyle = contentStyle;
  readonly controlsStyle = controlsStyle;
  readonly refreshProps = refreshProps;
  readonly status = refreshStatus;
  readonly draft = signal('a雪b');
  readonly accept = signal(true);
  readonly accepted = signal(0);
  readonly rejected = signal(0);
  readonly refreshing = signal(false);
  readonly mounted = signal(true);
  readonly modal = signal(false);
  readonly onDraftChange = (event: { text: string }) =>
    this.draft.set(event.text);
  readonly onRefresh = () => {
    if (this.accept()) {
      this.accepted.update(n => n + 1);
      this.refreshing.set(true);
    } else this.rejected.update(n => n + 1);
  };
  readonly actions = [
    { label: 'Finish refresh', run: () => this.refreshing.set(false) },
    {
      label: 'Toggle refresh mode',
      run: () => this.accept.update(value => !value),
    },
    { label: 'Start refresh', run: () => this.refreshing.set(true) },
    {
      label: 'Toggle refresh control',
      run: () => this.mounted.update(value => !value),
    },
    { label: 'Open refresh modal', run: () => this.modal.set(true) },
    { label: 'Reload refresh runtime', run: reloadModalRuntime },
  ];
}
