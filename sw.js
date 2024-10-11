const CACHE_NAME = 'drum-object-detection-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs',
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd',
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
