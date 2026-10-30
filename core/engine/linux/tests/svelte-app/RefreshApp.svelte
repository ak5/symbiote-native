<script>
  import { Modal } from '@symbiote-native/svelte';
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
  let draft = $state('a雪b'),
    accept = $state(true),
    accepted = $state(0),
    rejected = $state(0);
  let refreshing = $state(false),
    mounted = $state(true),
    modal = $state(false);
  function onRefresh() {
    if (accept) {
      accepted++;
      refreshing = true;
    } else rejected++;
  }
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
  <text style={textStyle}>
    {refreshStatus(accept, accepted, rejected, refreshing, mounted)}
  </text>
  <text-input
    accessible
    accessibilityLabel="Refresh draft"
    style={fieldStyle}
    value={draft}
    onValueChange={event => (draft = event.text)}
  />
  <text style={textStyle}>Refresh draft value: {draft}</text>
  <view style={rowStyle}>
    <scroll-view accessibilityLabel="Refresh scroll" style={scrollStyle}>
      {#if mounted}<refresh-control
          {...refreshProps}
          {refreshing}
          {onRefresh}
        />{/if}
      <view style={contentStyle}>
        <text style={textStyle}>Library content</text>
      </view>
    </scroll-view>
    <view style={controlsStyle}>
      {@render button('Finish refresh', () => (refreshing = false))}
      {@render button('Toggle refresh mode', () => (accept = !accept))}
      {@render button('Start refresh', () => (refreshing = true))}
      {@render button('Toggle refresh control', () => (mounted = !mounted))}
      {@render button('Open refresh modal', () => (modal = true))}
      {@render button('Reload refresh runtime', reloadModalRuntime)}
    </view>
  </view>
  <Modal
    visible={modal}
    animationType="none"
    accessibilityLabel="Refresh blocking modal"
    onRequestClose={() => (modal = false)}
  >
    {#snippet children()}<view style={cardStyle}>
        <text style={textStyle}>Refresh modal active</text>
      </view>{/snippet}
  </Modal>
</view>
