/* まち紹介ディスプレイ 沖縄本島版 Service Worker: 端末にすべて保存して、通信なしで起動できるようにする */
const BUILD = "2026-10-19.1955";
const CACHE = "okinawa-" + BUILD;
const FILES = ["./", "index.html", "data.js?v=" + BUILD, "fonts/dotgothic-sub.woff2", "manifest.webmanifest", "icon-180.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("okinawa-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
/* 保存済みを先に返し、通信できるときは裏で最新を取り直す。
   画面を開く要求（?付き・#付き・フォルダ名だけ等）は、保存済みが無ければ index.html を返す */
/* 音声ファイルは、ビルドを更新しても消えない別の保存場所に入れる(ファイル名に中身の識別子が付いているので、取り違えない) */
const VCACHE = "voice-okinawa-v1";
async function audioFetch(req) {
  const c = await caches.open(VCACHE);
  const idxKey = new URL("audio/index.json", self.registration.scope).href;
  if (req.url.indexOf("/audio/index.json") >= 0) {
    try { const r = await fetch(req); if (r.ok) { await c.put(idxKey, r.clone()); return r; } } catch (err) { /* 保存済みを返す */ }
    return (await c.match(idxKey)) || new Response("offline", { status: 503 });
  }
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r && r.ok) c.put(req, r.clone());
  return r;
}
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (new URL(req.url).pathname.indexOf("/audio/") >= 0) { e.respondWith(audioFetch(req)); return; }
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
