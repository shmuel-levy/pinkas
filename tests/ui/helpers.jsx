// Render the whole app around a given saved state, the way a returning user would open it.
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '../../src/store/index.js';
import { UiProvider } from '../../src/components/UiProvider.jsx';
import { defaultState } from '../../src/lib/storage.js';
import * as L from '../../src/lib/logic.js';
import { VERSION } from '../../src/lib/content.js';
import App from '../../src/App.jsx';

// An onboarded user who has already seen every guide and today's streak, so nothing pops up uninvited.
export function returningUser(patch = {}) {
  const s = defaultState();
  const t = L.todayISO();
  s.onboarded = true;
  s.balanceAnchor = { checking: 450000, cash: 30000, at: Date.now() - 1000 };
  s.visits = [t];
  Object.assign(s.settings, {
    lastSeenVersion: VERSION,
    streakShown: t,
    checkInPrompted: L.checkInStatus(s, t).period,
    toursSeen: { home: true, ledger: true, save: true, invest: true, insights: true, settings: true },
    installGuideSeen: true,
  });
  return { ...s, ...patch, settings: { ...s.settings, ...(patch.settings || {}) } };
}

export function renderApp(preloaded = returningUser(), ui) {
  const store = makeStore({ preloaded, ui });
  const utils = render(
    <Provider store={store}>
      <UiProvider>
        <App />
      </UiProvider>
    </Provider>,
  );
  return { store, ...utils };
}

export const food = (state) => state.categories.find((c) => c.name === 'אוכל בחוץ');
