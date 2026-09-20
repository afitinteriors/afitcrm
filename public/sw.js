// Minimal service worker: exists so the app is installable. It deliberately
// caches nothing and never touches a request -- every page, API and Supabase
// call goes straight to the network, so no authenticated data is ever stored.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// No "fetch" handler: the browser handles all requests natively (network-only).
