<script>
  import { Modal } from '@symbiote-native/svelte';
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
  let visible = $state(false),
    nested = $state(false),
    mode = $state('none');
  let background = $state('a雪b'),
    value = $state(''),
    nestedValue = $state('');
  let backgroundActions = $state(0),
    shown = $state(0),
    dismissed = $state(0);
  let requested = $state(0),
    nestedClosed = $state(0);
</script>

{#snippet button(label, onPress)}
  <pressable
    accessible
    accessibilityRole="button"
    accessibilityLabel={label}
    style={buttonStyle}
    {onPress}
  >
    <text style={textStyle}>{label}</text>
  </pressable>
{/snippet}
<view style={pageStyle}>
  <text-input
    accessible
    accessibilityLabel="Modal background"
    style={fieldStyle}
    value={background}
    onValueChange={event => (background = event.text)}
  />
  {@render button('Background action', () => backgroundActions++)}
  {#each modalModes as animation (animation)}
    {@render button(`Open ${animation} modal`, () => {
      mode = animation;
      value = '';
      nested = false;
      visible = true;
    })}
  {/each}
  <text accessibilityLabel="Background count" style={textStyle}>
    {backgroundActions}
  </text>
  <text accessibilityLabel="Modal lifecycle" style={textStyle}>
    {modalLifecycle(shown, dismissed, requested, nestedClosed)}
  </text>
  <view style={clipStyle}>
    <Modal
      {visible}
      animationType={mode}
      transparent={mode === 'slide'}
      accessibilityLabel="Native modal"
      onShow={() => shown++}
      onDismiss={() => dismissed++}
      onRequestClose={() => {
        requested++;
        visible = false;
      }}
    >
      <view style={cardStyle}>
        <text-input
          accessible
          accessibilityLabel="Modal editor"
          style={fieldStyle}
          {value}
          onValueChange={event => (value = event.text)}
        />
        <text accessibilityLabel="Modal shown count" style={textStyle}>
          {shown}
        </text>
        {@render button('Open nested modal', () => {
          nestedValue = '';
          nested = true;
        })}
        {@render button('Reload modal runtime', reloadModalRuntime)}
        <Modal
          visible={nested}
          animationType="fade"
          accessibilityLabel="Native nested modal"
          onRequestClose={() => (nested = false)}
          onDismiss={() => nestedClosed++}
        >
          <view style={cardStyle}>
            <text-input
              accessible
              accessibilityLabel="Nested editor"
              style={fieldStyle}
              value={nestedValue}
              onValueChange={event => (nestedValue = event.text)}
            />
          </view>
        </Modal>
      </view>
    </Modal>
  </view>
</view>
