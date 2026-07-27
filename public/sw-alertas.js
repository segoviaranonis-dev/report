/* Service worker alertas Aprobaciones · v2 persistente (requireInteraction). */
const SW_VERSION = "v2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function urlDesdeNotificacion(notification) {
  return (notification.data && notification.data.url) || "/aprobaciones?tab=pendientes";
}

async function abrirRuta(url) {
  const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of list) {
    if ("focus" in client) {
      await client.focus();
      if ("navigate" in client) {
        await client.navigate(url);
        return;
      }
    }
  }
  await self.clients.openWindow(url);
}

self.addEventListener("notificationclick", (event) => {
  const action = event.action;
  event.notification.close();

  if (action === "cerrar") {
    return;
  }

  const url = urlDesdeNotificacion(event.notification);
  event.waitUntil(abrirRuta(url));
});
