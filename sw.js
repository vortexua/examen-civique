const CACHE = "civique-v3";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(CORE.map(u => fetch(u, {cache: "no-store"}).then(res => res.ok && !res.redirected ? c.put(u, res) : null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Safari refuses to show a page if the service worker hands back a redirected response,
// so redirected responses are rebuilt as plain ones.
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, {status: res.status, statusText: res.statusText, headers: res.headers});
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);

  if (r.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await clean(await fetch(r));
        if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put("index.html", cp)); }
        return res;
      } catch (err) {
        return (await caches.match("index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  if (!sameOrigin && !isFont) return; // let the browser handle everything else

  e.respondWith((async () => {
    const hit = await caches.match(r);
    if (hit) return hit;
    const res = await fetch(r);
    if (res.ok || res.type === "opaque") { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  })());
});
