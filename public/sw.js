/* VoltIq service worker: shows app notifications, opens the right page on tap,
   and answers "Do you have light?" straight from the notification buttons. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'VoltIq', body: event.data.text() };
  }
  const check = data.check && data.check.id && data.check.token ? data.check : null;
  event.waitUntil(
    self.registration.showNotification(data.title || 'VoltIq', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      vibrate: [80, 40, 80],
      // Phones without buttons (iPhone) open the outage page, which asks the same question.
      actions: check
        ? [
            { action: 'on', title: 'Yes, I have light' },
            { action: 'off', title: 'No light' },
          ]
        : [],
      data: { url: data.url || '/dashboard', check },
    }),
  );
});

function answer(check, value) {
  return fetch('/api/checks/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: check.id, token: check.token, answer: value }),
  })
    .then((res) =>
      self.registration.showNotification(res.ok ? 'Thanks, that helps' : 'Couldn’t send your answer', {
        body: res.ok
          ? value === 'on'
            ? 'We’ve marked your block as having light.'
            : 'We’ve added you to the outage. We’ll tell you when a team is on it.'
          : 'Open VoltIq to answer instead.',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'check-thanks',
        data: { url: '/dashboard' },
      }),
    )
    .catch(() => undefined);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  if (data.check && (event.action === 'on' || event.action === 'off')) {
    event.waitUntil(answer(data.check, event.action));
    return;
  }
  const url = new URL(data.url || '/dashboard', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        open.navigate(url);
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
