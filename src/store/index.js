import { configureStore } from '@reduxjs/toolkit';
import data from './dataSlice.js';
import ui from './uiSlice.js';
import { load, save, STORAGE_KEY } from '../lib/storage.js';

/**
 * Builds the Redux store. `preloaded` lets tests start from any state;
 * otherwise the saved state is read from localStorage (same key/format as earlier versions,
 * so existing users keep their data).
 */
export function makeStore({ preloaded, ui: uiState, storage = globalThis.localStorage, persist = true } = {}) {
  const store = configureStore({
    reducer: { data, ui },
    preloadedState: { data: preloaded ?? load(storage), ...(uiState ? { ui: { ...ui(undefined, { type: '@@init' }), ...uiState } } : {}) },
  });
  if (persist) {
    // save after every change to the data slice (cheap: one JSON string)
    let last = store.getState().data;
    store.subscribe(() => {
      const cur = store.getState().data;
      if (cur !== last) {
        last = cur;
        if (!save(cur, storage)) window.dispatchEvent(new CustomEvent('pinkas:save-failed'));
      }
    });
  }
  return store;
}

export { STORAGE_KEY };
