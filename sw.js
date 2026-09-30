const CACHE="sashashtin-kicks-v1";
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["./","./index.html","./css/style.css","./js/app.js","./config.js","./manifest.json","./icon.svg"]))));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
