/* Service Worker: سامانه مدیریت پروژه‌های دفاتر مهندسی (PWA)
   با هر بار به‌روزرسانی محتوای برنامه، شماره نسخه زیر را ارتقا دهید. */
const CACHE_VERSION = 'crm-shell-v10';

// دریافت اسکوپ داینامیک جهت تطابق دقیق با ساب‌دایرکتوری گیت‌هاب پیجز
const SCOPE_URL = self.registration ? self.registration.scope : './';

const CORE_ASSETS = [
  SCOPE_URL,
  new URL('index.html', SCOPE_URL).toString(),
  new URL('manifest.json', SCOPE_URL).toString(),
  new URL('icon-192.png', SCOPE_URL).toString(),
  new URL('icon-512.png', SCOPE_URL).toString()
];

// ۱. مرحله نصب: کش کردن امن دارایی‌ها بدون شکست کلی در صورت ۴۰۴ بودن یک فایل
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async cache => {
      const cachePromises = CORE_ASSETS.map(async url => {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res.ok) {
            await cache.put(url, res);
          }
        } catch (err) {
          // در صورت غیبت موقت آیکون‌ها، چرخه نصب برنامه با شکست مواجه نمی‌شود
          console.warn(`[SW] دارایی در مرحله نصب رد شد: ${url}`);
        }
      });
      await Promise.all(cachePromises);
    }).then(() => self.skipWaiting())
  );
});

// ۲. مرحله فعال‌سازی: حذف کش‌های منسوخ و به دست گرفتن کنترل صفحات باز
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ۳. مدیریت پاسخ‌دهی به درخواست‌ها
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;
  const isGoogleFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isGoogleFont) return;

  // الف) صفحات ناوبری (باز کردن برنامه یا Refresh): Network-First با Fallback به کش
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(networkRes => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          // در زمان آفلاین بودن، ابتدا مسیر درخواستی و در غیر این صورت ریشه اپ بازخوانی شود
          const cachedPage = await caches.match(req, { ignoreSearch: true });
          if (cachedPage) return cachedPage;

          return (
            (await caches.match(new URL('index.html', SCOPE_URL).toString())) ||
            (await caches.match(SCOPE_URL))
          );
        })
    );
    return;
  }

  // ب) فونت‌ها: Cache-First (چون تغییر نمی‌کنند و ترافیک شبکه را ذخیره می‌کنند)
  if (isGoogleFont) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(networkRes => {
          if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
            const clone = networkRes.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, clone));
          }
          return networkRes;
        }).catch(() => null);
      })
    );
    return;
  }

  // ج) سایر فایل‌ها (آیکون، مانیفست و استایل): Stale-While-Revalidate
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const networkFetch = fetch(req)
        .then(networkRes => {
          if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
            const clone = networkRes.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
