/*
  generate-product-pages.js — КАРКАС генератора сторінок страв (/strava-<id>.html).

  Джерело даних: src/data/products.json (єдина база страв, зібрана з карток
  категорій + КБЖУ з product-details.js). Для кожної страви, у якої заповнено
  поле `seoText` (унікальний опис 120–200 слів), скрипт створює
  src/pages/strava-<id>.html і src/schema/product-<id>.json, після чого
  звичайний `node build/build.js` збирає їх у корінь, як і всі інші сторінки.

  Страви БЕЗ seoText пропускаються навмисно: сторінка з одним лише складом і
  ціною — це «тонкий контент», який Google не ранжує і може пессимізувати.

  Запуск:  node build/generate-product-pages.js          (лише звіт: що готово)
           node build/generate-product-pages.js --write  (створити файли)
  Опції:   --nutrition   виводити КБЖУ/алергени (за замовчуванням НІ — у
                         products.json вони позначені як демо-дані)
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'products.json'), 'utf8'));
const SITE_URL = 'https://pandasushi.od.ua';
const WRITE = process.argv.includes('--write');
const NUTRITION = process.argv.includes('--nutrition');

const CATEGORY_PAGE = { rolls: 'rolls', sety: 'sety', zapecheni: 'zapecheni', tempura: 'tempura', nigiri: 'nigiri', poke: 'poke', supy: 'supy', deserty: 'deserty', salaty: 'salaty', zakusky: 'zakusky', napoi: 'napoi', sousy: 'sousy' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function card(p) {
  const badges = p.badges.map((b) => `<span class="product-badge product-badge--${b.type}">${esc(b.label)}</span>`).join('');
  return `    <article class="product-card" data-tag="${p.tag}" data-price="${p.price}" data-rating="${p.rating}" data-votes="${p.votes}">
      <div class="product-card__media">
        <a href="/strava-${p.id}.html"><img src="${p.img}" alt="${esc(p.alt)}" width="280" height="263" loading="lazy"></a>${badges ? `\n        <div class="product-card__badges">${badges}</div>` : ''}
      </div>
      <div class="product-card__meta"><span>${esc(p.meta)}</span></div>
      <h3 class="product-card__name"><a href="/strava-${p.id}.html">${esc(p.name)}</a></h3>
      <p class="product-card__desc">${esc(p.desc)}</p>
      <div class="product-card__row">
        <span class="product-card__price">${p.price} ₴</span>
        <button type="button" class="add-to-cart-btn" data-add-to-cart data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}" data-img="${p.img}" aria-label="Додати «${esc(p.name)}» в кошик">+</button>
      </div>
    </article>`;
}

function pageHtml(p, related) {
  const title = `${p.name} — замовити з доставкою в Одесі | Панда Суші`;
  const description = `${p.name}: ${p.desc.replace(/\.$/, '')}. ${p.meta}, ${p.price} ₴. Доставка по Одесі за 45–70 хвилин, безкоштовно від 600 ₴.`;
  const ingredients = (p.ingredients || []).map((i) => `<li>${esc(i)}</li>`).join('');
  const nutrition = NUTRITION && p.nutrition ? `
  <section class="section">
    <h2>Харчова цінність на 100 г</h2>
    <div class="compare-wrap"><table class="compare-table"><thead><tr><th scope="col">Ккал</th><th scope="col">Білки</th><th scope="col">Жири</th><th scope="col">Вуглеводи</th><th scope="col">Алергени</th></tr></thead>
    <tbody><tr><td>${p.nutrition.kcal}</td><td>${p.nutrition.protein}</td><td>${p.nutrition.fat}</td><td>${p.nutrition.carbs}</td><td>${esc(p.nutrition.allergens)}</td></tr></tbody></table></div>
  </section>` : '';
  const seo = p.seoText.split(/\n\s*\n/).map((para) => `        <p>${para.trim()}</p>`).join('\n');
  const faq = (p.faq || []).map((f) => `      <details class="menu-faq-item">\n        <summary>${esc(f.q)}</summary>\n        <p>${esc(f.a)}</p>\n      </details>`).join('\n');
  return `<!--
title: ${title}
description: ${description}
canonical: /strava-${p.id}.html
ogImage: /assets/images/og/strava-${p.id}.jpg
bodyClass: page-product page-philadelphia
css: home, menu, philadelphia
schema: product-${p.id}.json
-->
<div class="container">
  <nav class="breadcrumbs" aria-label="Навігаційний ланцюжок">
    <a href="/">Головна</a><span>/</span><a href="/menu.html">Меню</a><span>/</span><a href="/${CATEGORY_PAGE[p.category]}.html">${esc(p.categoryName)}</a><span>/</span><span aria-current="page">${esc(p.name)}</span>
  </nav>

  <section class="collection-hero">
    <div class="collection-hero__main">
      <span class="collection-hero__badge">${esc(p.categoryName).toUpperCase()} · ${esc(p.meta)}</span>
      <h1>${esc(p.name)}</h1>
      <p class="collection-hero__lede">${esc(p.desc)}</p>
      <div class="collection-hero__actions">
        <button type="button" class="btn btn-primary add-to-cart-btn" data-add-to-cart data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}" data-img="${p.img}">Додати в кошик · ${p.price} ₴</button>
        <a href="/${CATEGORY_PAGE[p.category]}.html" class="btn btn-ghost">Усі ${esc(p.categoryName).toLowerCase()}</a>
      </div>
      <div class="collection-hero__stats">
        <span class="collection-hero__stat"><b>${p.price} ₴</b><span>${esc(p.meta)}</span></span>
        <span class="collection-hero__stat"><b>45–70 хв</b><span>доставка по Одесі</span></span>
      </div>
    </div>
    <div class="collection-hero__visual">
      <div class="collection-hero__img-wrap">
        <img src="${p.img}" alt="${esc(p.alt)}" width="500" height="500" fetchpriority="high">
      </div>
    </div>
  </section>

  <section class="section">
    <h2>Склад</h2>
    <ul class="product-ingredients">${ingredients}</ul>
  </section>
${nutrition}
  <section id="about" class="menu-about section">
    <span class="menu-about__glow" aria-hidden="true"></span>
    <div class="menu-about__grid">
      <div class="menu-about__main">
        <span class="eyebrow" style="margin-bottom:0">Про страву</span>
        <h2>${esc(p.seoTitle || p.name)}</h2>
${seo}
      </div>
    </div>
  </section>

  <h2 class="menu-section-title">З чим замовляють</h2>
  <div class="product-grid" style="margin-top:22px">
${related.map(card).join('\n')}
  </div>
${faq ? `
  <section id="faq" class="section">
    <h2 style="margin:0 0 20px">Питання про страву</h2>
    <div class="menu-faq-grid">
${faq}
    </div>
  </section>` : ''}
</div>
`;
}

function productSchema(p) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: SITE_URL + p.img,
    description: p.desc,
    category: p.categoryName,
    brand: { '@type': 'Brand', name: 'Панда Суші' },
    offers: { '@type': 'Offer', priceCurrency: 'UAH', price: String(p.price), availability: 'https://schema.org/InStock', url: `${SITE_URL}/strava-${p.id}.html`, seller: { '@id': `${SITE_URL}/#organization` } }
  };
}

function main() {
  const all = DATA.products;
  const ready = all.filter((p) => p.seoText && p.seoText.trim().split(/\s+/).length >= 100);
  console.log(`Страв у базі: ${all.length}. Готових до генерації (seoText ≥ 100 слів): ${ready.length}.`);
  if (!ready.length) { console.log('Заповніть поле seoText у src/data/products.json — і запустіть з --write.'); return; }
  if (!WRITE) { console.log('Режим звіту. Додайте --write, щоб створити файли:'); ready.forEach((p) => console.log('  -', p.id, '→ /strava-' + p.id + '.html')); return; }
  for (const p of ready) {
    const related = all.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 3);
    fs.writeFileSync(path.join(ROOT, 'src', 'pages', `strava-${p.id}.html`), pageHtml(p, related), 'utf8');
    fs.writeFileSync(path.join(ROOT, 'src', 'schema', `product-${p.id}.json`), JSON.stringify(productSchema(p), null, 2), 'utf8');
    console.log('  ✓ strava-' + p.id + '.html');
  }
  console.log('Далі: node build/build.js; додати URL у sitemap.xml; OG-картинки — gen_og.py.');
}

main();
