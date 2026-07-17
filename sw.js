// BGFCL Inventory Service Worker v1.4 — unified stock transaction (in/out ledger) system
const CACHE_NAME = 'bgfcl-v12';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Roboto+Mono:wght@400;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// এই ডোমেইনে যাওয়া কোনো রিকোয়েস্ট Service Worker কখনো ক্যাশ/ইন্টারসেপ্ট করবে না।
// আগে এখানে ভুল ছিল — Supabase-এর GET/POST/PATCH/DELETE সবকিছুই ক্যাশ করার
// চেষ্টা হতো, যার ফলে দুইটা সমস্যা হচ্ছিল:
//  ১) POST/PATCH/DELETE রিকোয়েস্ট ক্যাশে রাখার চেষ্টায় নীরব এরর হতো
//     (Cache API শুধু GET রিকোয়েস্ট সমর্থন করে)
//  ২) নেটওয়ার্ক সামান্য ধীর/অস্থির হলে fallback হিসেবে আগের (হয়তো অন্য
//     ব্যবহারকারী/সেশনের) ক্যাশ করা রেসপন্স দেখিয়ে দিতে পারতো — এটাই
//     সম্ভবত ইনকগনিটোতে "ডেটা আপডেট না হওয়া"-র মূল কারণ।
// এখন থেকে Supabase-এর সব কল সরাসরি নেটওয়ার্কে যাবে, Service Worker
// একদমই হাত দেবে না।
const NO_INTERCEPT_HOSTS = ['supabase.co', 'supabase.in'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { mode: 'no-cors' })));
    }).catch(() => {
      // Silently fail for cross-origin resources
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Supabase (বা অন্য কোনো data API) কল হলে Service Worker কিছুই করবে না —
  // respondWith() না ডাকলে ব্রাউজার নিজে থেকেই সরাসরি নেটওয়ার্কে পাঠাবে,
  // যেন Service Worker আদৌ নেই।
  if (NO_INTERCEPT_HOSTS.some(h => url.includes(h))) {
    return;
  }

  // শুধু GET রিকোয়েস্ট ক্যাশ করা যায় — POST/PATCH/DELETE ইত্যাদি সরাসরি
  // নেটওয়ার্কে পাঠানো হয়, ক্যাশে হাত দেওয়া হয় না।
  if (event.request.method !== 'GET') {
    return;
  }

  // ফন্ট/CDN লাইব্রেরি — ক্যাশ-প্রথম (দ্রুত লোডের জন্য, কম পরিবর্তনযোগ্য)
  if (url.includes('fonts.') || url.includes('cdnjs.')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // অ্যাপের নিজস্ব ফাইল (HTML/JS) — নেটওয়ার্ক-প্রথম, অফলাইনে ক্যাশ ফলব্যাক
  event.respondWith(
    fetch(event.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
