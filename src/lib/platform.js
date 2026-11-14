// Device / browser detection and small browser-API helpers (sharing, downloads, the calendar file).
import { reminderICS } from './logic.js';

export function platform() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  return {
    ios,
    android,
    otherIOSBrowser: ios && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua),
    inApp: /Instagram|FBAN|FBAV|WhatsApp|Line\/|TikTok/i.test(ua),
    samsung: /SamsungBrowser/i.test(ua),
    mobile: ios || android,
  };
}

export function isStandalone() {
  return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
}

// Android's own "install" prompt, kept for our button
let deferredPrompt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}
export const canPromptInstall = () => !!deferredPrompt;
export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice.catch(() => null);
  deferredPrompt = null;
  return choice?.outcome === 'accepted';
}

// Share sheet when available, otherwise a download
export async function shareOrDownload(filename, text, type) {
  const blob = new Blob([text], { type });
  const file = new File([blob], filename, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

// A real text/calendar file, served through the service worker so iOS offers "Add to Calendar"
export async function addCalendarReminder({ checkInDay, cycleDay }) {
  const ics = reminderICS({ checkInDay, cycleDay, url: location.origin + location.pathname });
  const url = new URL('reminder.ics', location.href).href;
  if ('caches' in window && navigator.serviceWorker?.controller) {
    try {
      const c = await caches.open('pinkas-gen');
      await c.put(url, new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } }));
      if (isStandalone()) location.href = url;
      else if (!window.open(url, '_blank')) location.href = url;
      return;
    } catch {}
  }
  await shareOrDownload('pinkas-reminder.ics', ics, 'text/calendar');
}

export async function shareApp() {
  const url = `${location.origin}${location.pathname}?ref=share`;
  const text = 'שקל בצד — אפליקציה לניהול הוצאות וחיסכון. חינם, בעברית, והנתונים נשארים אצלך. כשפותחים את הקישור מופיעות הוראות התקנה לאייפון או לאנדרואיד:';
  if (navigator.share) {
    try {
      await navigator.share({ title: 'שקל בצד', text, url });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancel';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return url;
  }
}
