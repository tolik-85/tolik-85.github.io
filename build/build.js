/*
  build.js — простий "складальник" сторінок сайту. Це НЕ фреймворк і нічого
  не виконується в браузері користувача — це лише Node-скрипт для розробки,
  який один раз (на етапі підготовки сайту) склеює однакову шапку/підвал
  з унікальним вмістом кожної сторінки і зберігає результат як звичайний
  готовий HTML-файл. У браузері виконується вже тільки чистий HTML/CSS/JS.

  Навіщо це потрібно: шапка (header) і підвал (footer) однакові на всіх
  14 сторінках сайту. Без цього скрипта довелось би вручну копіювати їх
  у кожен HTML-файл і синхронізувати зміни в 14 місцях. Тут — редагуєш
  src/partials/header.html один раз, запускаєш `node build/build.js`,
  і всі сторінки оновлюються.

  Як запустити:  node build/build.js     (або: npm run build)
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'src', 'pages');
const PARTIALS_DIR = path.join(ROOT, 'src', 'partials');
const OUT_DIR = ROOT; // готові *.html лежать у корені сайту

const SITE_NAME = 'Панда Суші';
const SITE_URL = 'https://pandasushi.od.ua';

const header = fs.readFileSync(path.join(PARTIALS_DIR, 'header.html'), 'utf8');
const footer = fs.readFileSync(path.join(PARTIALS_DIR, 'footer.html'), 'utf8');

// ---- Мінімальний, але точний JS-мінімізатор (без залежностей) — навмисно
// НЕ універсальний: розпізнає лише рядки в лапках ('...'/"...") і коментарі
// (// та /* */), не чіпає regex-літерали й template-строки. Застосовується
// лише до common.js — перевірено (одноразово, скретчпад-скриптом), що там
// немає ні одного, ні іншого, тож спрощення безпечне саме для цього файлу.
function minifyJs(src) {
  let out = '';
  let state = 'code'; // code | sq | dq | line-comment | block-comment
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const c2 = src[i + 1];
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line-comment'; i++; continue; }
      if (c === '/' && c2 === '*') { state = 'block-comment'; i++; continue; }
      if (c === "'") { state = 'sq'; out += c; continue; }
      if (c === '"') { state = 'dq'; out += c; continue; }
      out += c;
    } else if (state === 'sq' || state === 'dq') {
      out += c;
      if (c === '\\') { out += c2; i++; continue; }
      if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"')) state = 'code';
    } else if (state === 'line-comment') {
      if (c === '\n') { out += '\n'; state = 'code'; }
    } else if (state === 'block-comment') {
      if (c === '*' && c2 === '/') { state = 'code'; i++; }
    }
  }
  // Прибираємо ведучі/кінцеві пробіли й порожні рядки — перенос рядка лишаємо
  // на місці (ASI залежить від нього, а не від пробілів на початку рядка).
  return out.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

// ---- Автогенерація JSON-LD (BreadcrumbList / ItemList+Product / FAQPage) з
// уже наявної видимої розмітки — жодного дубльованого джерела правди: якщо
// зміниться `.breadcrumbs`/`.product-card`/`.menu-faq-item` на сторінці,
// структуровані дані оновляться самі при наступній збірці.
function decodeEntities(str) {
  return String(str)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonLdScript(obj) {
  // Екрануємо "<", щоб JSON-рядок не міг випадково закрити </script> раніше часу.
  return `  <script type="application/ld+json">${JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')}</script>`;
}

function extractBreadcrumbSchema(content, canonicalUrl) {
  const navMatch = content.match(/<nav class="breadcrumbs"[^>]*>([\s\S]*?)<\/nav>/);
  if (!navMatch) return null;
  const inner = navMatch[1];
  const items = [];
  const linkRe = /<a href="([^"]+)">([^<]+)<\/a>/g;
  let m;
  while ((m = linkRe.exec(inner))) {
    const href = m[1];
    items.push({ name: decodeEntities(m[2]), item: /^https?:\/\//.test(href) ? href : SITE_URL + href });
  }
  const currentMatch = inner.match(/aria-current="page">([^<]+)</);
  if (currentMatch) items.push({ name: decodeEntities(currentMatch[1]), item: canonicalUrl });
  if (items.length < 2) return null; // головна й самотні якорі — крихти не потрібні
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.item }))
  };
}

function extractCatalogSchema(content, canonicalUrl) {
  const cards = content.match(/<article class="product-card"[\s\S]*?<\/article>/g);
  if (!cards || !cards.length) return null;
  const items = [];
  cards.forEach((card) => {
    const name = (card.match(/<h3 class="product-card__name">([\s\S]*?)<\/h3>/) || [])[1];
    const desc = (card.match(/<p class="product-card__desc">([\s\S]*?)<\/p>/) || [])[1];
    const price = (card.match(/data-price="([\d.]+)"/) || [])[1];
    const img = (card.match(/<img src="([^"]+)"/) || [])[1];
    if (!name || !price) return;
    const product = {
      '@type': 'Product',
      name: decodeEntities(name),
      offers: {
        '@type': 'Offer',
        priceCurrency: 'UAH',
        price,
        availability: 'https://schema.org/InStock',
        url: canonicalUrl
      }
    };
    if (desc) product.description = decodeEntities(desc);
    if (img) product.image = SITE_URL + img;
    items.push(product);
  });
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item }))
  };
}

function extractFaqSchema(content, meta) {
  // Не дублюємо FAQPage, якщо сторінка вже підключає власний файл схеми
  // через frontmatter `schema:` (index/rolls/sety/zapecheni — faq-*.json).
  if (/faq/i.test(meta.schema || '')) return null;
  const blocks = content.match(/<details class="menu-faq-item">[\s\S]*?<\/details>/g);
  if (!blocks || !blocks.length) return null;
  const mainEntity = blocks.map((block) => {
    const q = (block.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1];
    const a = (block.match(/<p>([\s\S]*?)<\/p>/) || [])[1];
    if (!q || !a) return null;
    return { '@type': 'Question', name: decodeEntities(q), acceptedAnswer: { '@type': 'Answer', text: decodeEntities(a) } };
  }).filter(Boolean);
  if (!mainEntity.length) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity };
}

// ---- Розбирає простий frontmatter у форматі HTML-коментаря на початку файлу:
// <!--
// title: Значення заголовка
// description: Значення опису
// -->
// ...далі йде HTML-вміст сторінки...
function parsePage(raw) {
  const match = raw.match(/^<!--([\s\S]*?)-->\s*([\s\S]*)$/);
  if (!match) {
    throw new Error('У сторінці відсутній frontmatter-коментар на початку файлу');
  }
  const [, frontRaw, content] = match;
  const meta = {};
  for (const line of frontRaw.split('\n')) {
    const m = line.match(/^\s*([a-zA-Z0-9_]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return { meta, content };
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function buildHead(meta, content) {
  const canonicalPath = meta.canonical || '/';
  const canonicalUrl = SITE_URL + canonicalPath;
  const ogImage = meta.ogImage ? SITE_URL + meta.ogImage : SITE_URL + '/assets/images/og/default.jpg';
  const extraCss = (meta.css || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => `  <link rel="stylesheet" href="/assets/css/${name}.css">`)
    .join('\n');
  // Кілька файлів схеми на одну сторінку (напр. restaurant.json + faq-index.json) —
  // той самий split(',') патерн, що й extraCss/extraJs.
  const extraSchema = (meta.schema || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => `  <script type="application/ld+json">${fs.readFileSync(path.join(ROOT, 'src', 'schema', name), 'utf8').trim()}</script>`)
    .join('\n');
  // Автосхема з видимої розмітки самої сторінки (див. функції extract* вище) —
  // не потребує ручного frontmatter, оновлюється разом з контентом.
  const autoSchema = [
    extractBreadcrumbSchema(content, canonicalUrl),
    extractCatalogSchema(content, canonicalUrl),
    extractFaqSchema(content, meta)
  ].filter(Boolean).map(jsonLdScript).join('\n');
  const robots = meta.noindex === 'true' ? 'noindex, nofollow' : 'index, follow';

  return `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${meta.title}</title>
  <meta name="description" content="${escapeAttr(meta.description || '')}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="${robots}">
  <meta name="theme-color" content="#131110">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${escapeAttr(meta.title)}">
  <meta property="og:description" content="${escapeAttr(meta.description || '')}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeAttr(meta.title)}">
  <meta property="og:locale" content="uk_UA">
  <meta name="twitter:card" content="summary_large_image">

  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/assets/images/icons/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/images/icons/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">

  <!-- Шрифти self-hosted (той самий origin) — preconnect не потрібен, лише
       preload двох найчастіше вживаних файлів (кирилиця, вага 400), щоб
       браузер почав качати їх ще до розбору fonts.css. -->
  <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/manrope-cyrillic.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/prata-cyrillic.woff2" crossorigin>

  <link rel="stylesheet" href="/assets/css/fonts.css">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/header.css">
  <link rel="stylesheet" href="/assets/css/footer.css">
  <link rel="stylesheet" href="/assets/css/cart.css">
  <link rel="stylesheet" href="/assets/css/product-popup.css">
  <link rel="stylesheet" href="/assets/css/mobile-tabbar.css">
${extraCss}${extraSchema ? `\n${extraSchema}` : ''}${autoSchema ? `\n${autoSchema}` : ''}`;
}

function buildScripts(meta) {
  const extraJs = (meta.js || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => `  <script src="/assets/js/${name}.js" defer></script>`)
    .join('\n');
  // common.js підключається мінімізованою збіркою (common.min.js, генерується
  // нижче в main()) — редагувати треба common.js, common.min.js лише читати.
  return `  <script src="/assets/js/common.min.js" defer></script>\n  <script src="/assets/js/product-details.js" defer></script>\n${extraJs}`;
}

function buildPage(fileName) {
  const raw = fs.readFileSync(path.join(PAGES_DIR, fileName), 'utf8');
  const { meta, content } = parsePage(raw);
  if (!meta.title) throw new Error(`${fileName}: відсутній title у frontmatter`);

  const html = `<!DOCTYPE html>
<html lang="uk">
<head>
${buildHead(meta, content)}
</head>
<body class="${meta.bodyClass || ''}">
  <a class="skip-link" href="#main">Перейти до основного вмісту</a>
${header}
${content.trim()}
${footer}
${buildScripts(meta)}
</body>
</html>
`;

  // Dev-коментарі лишаються тільки в src/ — зі збірки їх прибираємо: читачеві
  // готового HTML вони не потрібні (зайві байти), а `--` всередині коментаря
  // (BEM-класи на кшталт ...--icon) ламає XML-сумісність за W3C-валідатором.
  // Умовних IE-коментарів на сайті немає, тож вирізати можна все підряд.
  // Інлайн-скрипти — лише JSON-LD з екранованим "<" (jsonLdScript), випадково
  // зачепити "<!--" всередині скрипта регулярка не може.
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');

  const outName = fileName.replace(/\.html$/, '') + '.html';
  fs.writeFileSync(path.join(OUT_DIR, outName), cleaned, 'utf8');
  console.log('  ✓', outName);
}

function buildCommonMinJs() {
  const srcPath = path.join(ROOT, 'assets', 'js', 'common.js');
  const outPath = path.join(ROOT, 'assets', 'js', 'common.min.js');
  const src = fs.readFileSync(srcPath, 'utf8');
  const min = minifyJs(src);
  fs.writeFileSync(outPath, min, 'utf8');
  const before = Buffer.byteLength(src, 'utf8');
  const after = Buffer.byteLength(min, 'utf8');
  console.log(`  ✓ common.min.js (${before} → ${after} байт, −${Math.round((1 - after / before) * 100)}%)`);
}

function main() {
  buildCommonMinJs();
  const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.html'));
  console.log(`Збірка ${files.length} сторінок...`);
  for (const file of files) buildPage(file);
  console.log('Готово. Файли записані в корінь сайту (site/*.html).');
}

main();
