import { createSignal } from 'solid-js';
import { Modal } from '@symbiote-native/solid';
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

const button = (label, onPress) => (
  <pressable
    accessible
    accessibilityRole="button"
    accessibilityLabel={label}
    style={buttonStyle}
    onPress={onPress}
  >
    <text style={textStyle}>{label}</text>
  </pressable>
);

export default function RefreshApp() {
  const [draft, setDraft] = createSignal('a雪b'),
    [accept, setAccept] = createSignal(true);
  const [accepted, setAccepted] = createSignal(0),
    [rejected, setRejected] = createSignal(0);
  const [refreshing, setRefreshing] = createSignal(false),
    [mounted, setMounted] = createSignal(true);
  const [modal, setModal] = createSignal(false);
  const onRefresh = () => {
    if (accept()) {
      setAccepted(n => n + 1);
      setRefreshing(true);
    } else setRejected(n => n + 1);
  };
  return (
    <view style={pageStyle}>
      <text style={textStyle}>
        {refreshStatus(
          accept(),
          accepted(),
          rejected(),
          refreshing(),
          mounted(),
        )}
      </text>
      <text-input
        accessible
        accessibilityLabel="Refresh draft"
        style={fieldStyle}
        value={draft()}
        onValueChange={event => setDraft(event.text)}
      />
      <text style={textStyle}>Refresh draft value: {draft()}</text>
      <view style={rowStyle}>
        <scroll-view accessibilityLabel="Refresh scroll" style={scrollStyle}>
          {mounted() ? (
            <refresh-control
              {...refreshProps}
              refreshing={refreshing()}
              onRefresh={onRefresh}
            />
          ) : null}
          <view style={contentStyle}>
            <text style={textStyle}>Library content</text>
          </view>
        </scroll-view>
        <view style={controlsStyle}>
          {button('Finish refresh', () => setRefreshing(false))}
          {button('Toggle refresh mode', () => setAccept(value => !value))}
          {button('Start refresh', () => setRefreshing(true))}
          {button('Toggle refresh control', () => setMounted(value => !value))}
          {button('Open refresh modal', () => setModal(true))}
          {button('Reload refresh runtime', reloadModalRuntime)}
        </view>
      </view>
      <Modal
        visible={modal()}
        animationType="none"
        accessibilityLabel="Refresh blocking modal"
        onRequestClose={() => setModal(false)}
      >
        <view style={cardStyle}>
          <text style={textStyle}>Refresh modal active</text>
        </view>
      </Modal>
    </view>
  );
}
