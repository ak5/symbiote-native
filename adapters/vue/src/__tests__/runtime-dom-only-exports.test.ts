// runtime-helpers exposes renderer-agnostic exports from the Vue peer, so a DOM-only export
// resolves to undefined unless this module grows its own (vShow/vModelText's history).
// useCssVars is a deliberate, deferred gap (see vue-adapter-gap-list reference).

import { describe, expect, it } from 'vitest';
import * as VuePeer from 'vue';
import * as runtimeHelpers from '@symbiote-native/vue/runtime-helpers';

describe('vue runtime-dom-only exports through the Metro-rewritten "vue" import', () => {
  it('Transition has a native implementation', () => {
    expect(
      (runtimeHelpers as Record<string, unknown>).Transition,
    ).toBeDefined();
  });

  it('TransitionGroup has a native implementation', () => {
    expect(
      (runtimeHelpers as Record<string, unknown>).TransitionGroup,
    ).toBeDefined();
  });

  it('useCssVars is still missing (deferred, no CSS custom-property foundation yet)', () => {
    expect(
      (runtimeHelpers as Record<string, unknown>).useCssVars,
    ).toBeUndefined();
  });
});

it('shares component ownership, reactivity and compiler helpers with the app peer', () => {
  for (const name of [
    'createRenderer',
    'ref',
    'h',
    'getCurrentInstance',
    'withAsyncContext',
    'mergeDefaults',
    'mergeModels',
    'createPropsRestProxy',
  ]) {
    expect(Reflect.get(runtimeHelpers, name), name).toBe(
      Reflect.get(VuePeer, name),
    );
    expect(Reflect.get(runtimeHelpers, name), name).toBeTypeOf('function');
  }
});
