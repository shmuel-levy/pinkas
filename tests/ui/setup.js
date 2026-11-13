// jsdom is missing a few browser APIs the app uses. Minimal stand-ins, enough for behaviour tests.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// <dialog>: showModal/close toggle the `open` attribute and fire "close" like the real thing
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.show = function show() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

// "reduce motion" on: every animation jumps to its end state, so tests don't wait on timers
window.matchMedia = (q) => ({
  matches: q.includes('reduce'), media: q, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
});
window.scrollTo = () => {};
Element.prototype.scrollIntoView = function scrollIntoView() {};
window.confirm = () => true;
// the app fetches the daily dollar rate; tests stay offline
globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline in tests')));

afterEach(() => {
  cleanup();
  localStorage.clear();
});
