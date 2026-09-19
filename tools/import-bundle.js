#!/usr/bin/env node
// Converts a self-unpacking "bundled" console HTML (e.g. "Internal Medicine
// Training Suite (Offline)_V19.html") into a plain, multi-file web app in ./app:
//   app/index.html, app/vendor/*.js, app/fonts/*.woff2, app/icons/*,
//   app/manifest.webmanifest, app/sw.js (offline cache)
// It also writes build/icon.png, which electron-builder uses for the
// Windows .exe and the macOS .app/.dmg icons.
//
// Usage: node tools/import-bundle.js "<path to bundled .html>"

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const BUILD = path.join(ROOT, 'build');

const APP_NAME = 'Internal Medicine Training Suite';
const SHORT_NAME = 'IM Training';
const THEME = '#8c491a';
const BG = '#f5ead8';
const ICON_BG = '#14264f'; // navy of the department badge, fills the maskable icon's safe-zone padding

function readBundleScript(src, type) {
  const open = `<script type="__bundler/${type}">`;
  const start = src.indexOf(open);
  if (start < 0) return null;
  const end = src.indexOf('</script>', start);
  return JSON.parse(src.slice(start + open.length, end));
}

function decode(entry) {
  let buf = Buffer.from(entry.data, 'base64');
  if (entry.compressed) buf = zlib.gunzipSync(buf);
  return buf;
}

async function main() {
  const input = process.argv[2];
  if (!input || !fs.existsSync(input)) {
    console.error('Usage: node tools/import-bundle.js "<bundled console .html>"');
    process.exit(1);
  }
  const src = fs.readFileSync(input, 'utf8');
  const manifest = readBundleScript(src, 'manifest');
  let html = readBundleScript(src, 'template');
  if (!manifest || typeof html !== 'string') {
    throw new Error('This file is not a bundled console (no __bundler manifest/template found).');
  }
  const pageOrder = readBundleScript(src, 'page_order') || [];
  if (pageOrder.length) throw new Error('Nested page bundles are not supported by this converter.');

  fs.rmSync(APP, { recursive: true, force: true });
  for (const d of ['vendor', 'fonts', 'img', 'icons']) fs.mkdirSync(path.join(APP, d), { recursive: true });
  fs.mkdirSync(BUILD, { recursive: true });

  let logo = null;
  const written = [];
  for (const [uuid, entry] of Object.entries(manifest)) {
    const bytes = decode(entry);
    const referenced = html.includes(uuid);
    const short = uuid.slice(0, 8);
    let rel;
    if (/^font\//.test(entry.mime)) rel = `fonts/${short}.${entry.mime.split('/')[1] || 'woff2'}`;
    else if (/javascript/.test(entry.mime)) {
      const head = bytes.slice(0, 300).toString('utf8');
      const lib = (head.match(/@license\s+([\w.-]+)/) || [])[1];
      rel = `vendor/${lib ? lib.toLowerCase() : short}.js`;
    } else if (/^image\//.test(entry.mime)) {
      rel = `img/${short}.${entry.mime.split('/')[1].replace('svg+xml', 'svg')}`;
      if (!logo && entry.mime === 'image/png') logo = bytes;
    } else if (/css/.test(entry.mime)) rel = `vendor/${short}.css`;
    else rel = `img/${short}.bin`;

    if (!referenced) continue; // shipped in the bundle but never used by the page
    fs.writeFileSync(path.join(APP, rel), bytes);
    html = html.split(uuid).join(rel);
    written.push(rel);
  }

  // Same fix the bundle loader applied: SRI/crossorigin are meaningless for local files.
  html = html.replace(/\s+integrity="[^"]*"/gi, '').replace(/\s+crossorigin="[^"]*"/gi, '');

  // ---- Icons -------------------------------------------------------------
  const sharp = require('sharp');
  // build/app-icon-source.png (custom app icon) wins over the logo embedded in the bundle.
  const customIcon = path.join(BUILD, 'app-icon-source.png');
  const iconSrc = fs.existsSync(customIcon) ? fs.readFileSync(customIcon) : (logo || Buffer.from(defaultSvg()));
  const square = await sharp(iconSrc)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  fs.writeFileSync(path.join(BUILD, 'icon.png'), square);
  for (const size of [192, 512]) {
    await sharp(square).resize(size, size).png().toFile(path.join(APP, 'icons', `icon-${size}.png`));
  }
  // Maskable icon: logo inside the 80% safe zone on the theme background.
  const inner = await sharp(square).resize(400, 400).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: ICON_BG } })
    .composite([{ input: inner, gravity: 'center' }]).png()
    .toFile(path.join(APP, 'icons', 'maskable-512.png'));
  const innerApple = await sharp(square).resize(160, 160).png().toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 4, background: '#ffffff' } })
    .composite([{ input: innerApple, gravity: 'center' }]).png()
    .toFile(path.join(APP, 'icons', 'apple-touch-icon.png'));
  await sharp(square).resize(32, 32).png().toFile(path.join(APP, 'icons', 'favicon-32.png'));
  written.push('icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
    'icons/apple-touch-icon.png', 'icons/favicon-32.png');

  // ---- Web app manifest -------------------------------------------------
  const webManifest = {
    name: APP_NAME,
    short_name: SHORT_NAME,
    description: 'Offline internal medicine clinical training and attendance console.',
    lang: 'ar',
    dir: 'rtl',
    start_url: './',
    scope: './',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: BG,
    theme_color: THEME,
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
  fs.writeFileSync(path.join(APP, 'manifest.webmanifest'), JSON.stringify(webManifest, null, 2));

  // ---- Head/body injections --------------------------------------------
  const headTags = [
    `<link rel="manifest" href="manifest.webmanifest">`,
    `<meta name="theme-color" content="${THEME}">`,
    `<meta name="application-name" content="${APP_NAME}">`,
    `<meta name="apple-mobile-web-app-capable" content="yes">`,
    `<meta name="mobile-web-app-capable" content="yes">`,
    `<meta name="apple-mobile-web-app-title" content="${SHORT_NAME}">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">`,
    `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`
  ].join('\n');
  const headOpen = html.match(/<head[^>]*>/i);
  if (!headOpen) throw new Error('Template has no <head>.');
  const hi = headOpen.index + headOpen[0].length;
  html = html.slice(0, hi) + '\n' + headTags + html.slice(hi);

  // Service worker only runs from http(s) (hosted/localhost), never file:// or the desktop app.
  const swTag = `<script>
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('SW registration failed', e); }); });
}
</script>`;
  const bodyClose = html.lastIndexOf('</body>');
  html = bodyClose >= 0 ? html.slice(0, bodyClose) + swTag + '\n' + html.slice(bodyClose) : html + swTag;

  fs.writeFileSync(path.join(APP, 'index.html'), html);
  written.unshift('index.html', 'manifest.webmanifest');

  // ---- Service worker (offline cache, versioned by content hash) -----------
  const hash = crypto.createHash('sha256');
  for (const rel of written) hash.update(fs.readFileSync(path.join(APP, rel)));
  const version = hash.digest('hex').slice(0, 12);
  const precache = ['./', ...written];
  fs.writeFileSync(path.join(APP, 'sw.js'), swSource(version, precache));

  fs.writeFileSync(path.join(ROOT, 'app-source.json'), JSON.stringify({
    importedFrom: path.basename(input), importedAt: new Date().toISOString(), version
  }, null, 2));

  console.log(`Imported ${path.basename(input)} -> app/ (${written.length} files, cache ${version})`);
}

function swSource(version, precache) {
  return `// Generated by tools/import-bundle.js — do not edit by hand.
const CACHE = 'im-suite-${version}';
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('im-suite-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // optional online extras (fonts, time check) go straight to network
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
`;
}

function defaultSvg() {
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<rect x="24" y="20" width="72" height="84" rx="10" fill="#8c491a"/>
<rect x="34" y="34" width="52" height="8" rx="4" fill="#f5ead8"/>
<rect x="34" y="50" width="52" height="6" rx="3" fill="#c67139"/>
<rect x="34" y="62" width="34" height="6" rx="3" fill="#c67139"/>
<rect x="34" y="80" width="20" height="14" rx="4" fill="#7a8a5e"/>
<rect x="60" y="80" width="26" height="14" rx="4" fill="#f5ead8"/></svg>`;
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
