/* まち紹介ディスプレイ 青森版 Service Worker: 端末にすべて保存して、通信なしで起動できるようにする */
const BUILD = "2026-10-16.0658";
const CACHE = "aomori-" + BUILD;
const FILES = ["./", "index.html", "data.js?v=" + BUILD, "fonts/dotgothic-sub.woff2", "manifest.webmanifest", "icon-180.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("aomori-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
/* 保存済みを先に返し、通信できるときは裏で最新を取り直す。
   画面を開く要求（?付き・#付き・フォルダ名だけ等）は、保存済みが無ければ index.html を返す */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const nav = req.mode === "navigate";
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      let hit = await c.match(req);
      if (!hit && nav) hit = (await c.match("index.html")) || (await c.match("./"));
      if (!hit && !nav) hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req)
        .then((r) => { if (r && r.ok && !nav) c.put(req, r.clone()); return r; })
        .catch(() => hit || new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } }));
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    })
  );
});
