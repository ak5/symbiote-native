import { createSignal } from 'solid-js';
import { Modal } from '@symbiote-native/solid';
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

export default function ModalApp() {
  const [visible, setVisible] = createSignal(false),
    [nested, setNested] = createSignal(false);
  const [mode, setMode] = createSignal('none'),
    [background, setBackground] = createSignal('a雪b');
  const [value, setValue] = createSignal(''),
    [nestedValue, setNestedValue] = createSignal('');
  const [backgroundActions, setBackgroundActions] = createSignal(0),
    [shown, setShown] = createSignal(0);
  const [dismissed, setDismissed] = createSignal(0),
    [requested, setRequested] = createSignal(0);
  const [nestedClosed, setNestedClosed] = createSignal(0);
  return (
    <view style={pageStyle}>
      <text-input
        accessible
        accessibilityLabel="Modal background"
        style={fieldStyle}
        value={background()}
        onValueChange={event => setBackground(event.text)}
      />
      {button('Background action', () =>
        setBackgroundActions(count => count + 1),
      )}
      {modalModes.map(animation =>
        button(`Open ${animation} modal`, () => {
          setMode(animation);
          setValue('');
          setNested(false);
          setVisible(true);
        }),
      )}
      <text accessibilityLabel="Background count" style={textStyle}>
        {backgroundActions()}
      </text>
      <text accessibilityLabel="Modal lifecycle" style={textStyle}>
        {modalLifecycle(shown(), dismissed(), requested(), nestedClosed())}
      </text>
      <view style={clipStyle}>
        <Modal
          visible={visible()}
          animationType={mode()}
          transparent={mode() === 'slide'}
          accessibilityLabel="Native modal"
          onShow={() => setShown(count => count + 1)}
          onDismiss={() => setDismissed(count => count + 1)}
          onRequestClose={() => {
            setRequested(count => count + 1);
            setVisible(false);
          }}
        >
          <view style={cardStyle}>
            <text-input
              accessible
              accessibilityLabel="Modal editor"
              style={fieldStyle}
              value={value()}
              onValueChange={event => setValue(event.text)}
            />
            <text accessibilityLabel="Modal shown count" style={textStyle}>
              {shown()}
            </text>
            {button('Open nested modal', () => {
              setNestedValue('');
              setNested(true);
            })}
            {button('Reload modal runtime', reloadModalRuntime)}
            <Modal
              visible={nested()}
              animationType="fade"
              accessibilityLabel="Native nested modal"
              onRequestClose={() => setNested(false)}
              onDismiss={() => setNestedClosed(count => count + 1)}
            >
              <view style={cardStyle}>
                <text-input
                  accessible
                  accessibilityLabel="Nested editor"
                  style={fieldStyle}
                  value={nestedValue()}
                  onValueChange={event => setNestedValue(event.text)}
                />
              </view>
            </Modal>
          </view>
        </Modal>
      </view>
    </view>
  );
}
