import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { makeStore } from './store/index.js';
import { UiProvider, useOverlay } from './components/UiProvider.jsx';
import { isStandalone, platform } from './lib/platform.js';
import App from './App.jsx';
import './styles/main.scss';

const params = new URLSearchParams(location.search);
const fromShare = params.get('ref') === 'share';
const store = makeStore();
const { data } = store.getState();
// a friend's shared link, or a first visit on a phone browser: show how to install first
const showInstall = !isStandalone() && (fromShare || (!data.onboarded && platform().mobile && !data.settings.installGuideSeen));
if (showInstall) store.dispatch({ type: 'ui/setInstall', payload: { show: true, fromShare } });

// Offline support + updates: a new version downloaded in the background offers a refresh
function UpdateWatcher() {
  const { toast } = useOverlay();
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    const register = () => navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            toast('יש גרסה חדשה של שקל בצד', { action: 'לרענן', onAction: () => location.reload(), ms: 15000 });
          }
        });
      });
    }).catch((err) => console.warn('sw registration failed', err));
    // React may render after the page's load event has already fired
    if (document.readyState === 'complete') register();
    else addEventListener('load', register, { once: true });
  }, [toast]);
  return null;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <UiProvider>
        <UpdateWatcher />
        <App />
      </UiProvider>
    </Provider>
  </StrictMode>,
);

// for debugging in the console only
window.__pinkas = { store };
