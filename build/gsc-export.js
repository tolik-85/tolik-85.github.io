/*
  gsc-export.js — автоматична вигрузка даних Google Search Console у CSV.

  Запускається НЕ в браузері й НЕ на хостингу — тільки в GitHub Actions
  (.github/workflows/gsc-export.yml) за розкладом або вручну. Локально можна
  запустити так:  GSC_SERVICE_ACCOUNT_JSON="$(cat ключ.json)" node build/gsc-export.js

  Що робить:
    1. Авторизується сервісним акаунтом Google (JWT RS256 → OAuth token).
    2. Знаходить ресурс pandasushi.od.ua серед доступних у Search Console.
    3. Забирає Search Analytics за останній повний тиждень (з урахуванням
       затримки даних GSC ~3 дні) у чотирьох зрізах: запити, сторінки,
       запит+сторінка, по днях.
    4. Пише CSV у seo-data/gsc/<кінцева-дата>/ + summary.json з підсумками.
       Папка seo-data/ виключена з деплою на хостинг — це внутрішня аналітика.
*/
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SITE_MATCH = 'pandasushi.od.ua';
const ROOT = path.join(__dirname, '..');

const KEY = JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON || 'null');
if (!KEY || !KEY.client_email || !KEY.private_key) {
  console.error('Немає GSC_SERVICE_ACCOUNT_JSON (або в ньому нема client_email/private_key)');
  process.exit(1);
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: KEY.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: KEY.token_uri,
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(header + '.' + claims);
  const jwt = header + '.' + claims + '.' + b64url(signer.sign(KEY.private_key));

  const res = await fetch(KEY.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('OAuth не вдався: ' + JSON.stringify(j));
  return j.access_token;
}

async function api(token, url, body) {
  // До 3 спроб: на раннерах GitHub зрідка трапляється разовий мережевий
  // збій ("fetch failed" без HTTP-коду) — повтор через паузу його лікує.
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json();
      if (!res.ok) throw new Error('API ' + url + ' -> ' + res.status + ': ' + JSON.stringify(j).slice(0, 300));
      return j;
    } catch (e) {
      lastErr = e;
      if (String(e.message).startsWith('API ')) throw e; // HTTP-помилка — повторювати нема сенсу
      console.error('Спроба ' + attempt + ' не вдалася: ' + e.message + (e.cause ? ' (причина: ' + e.cause + ')' : ''));
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function writeCsv(file, headerCols, rows, keyCount) {
  const lines = [headerCols.join(',')];
  for (const r of rows) {
    const keys = (r.keys || []).slice(0, keyCount);
    lines.push([
      ...keys.map(csvEscape),
      r.clicks,
      r.impressions,
      (r.ctr * 100).toFixed(2),
      r.position.toFixed(1),
    ].join(','));
  }
  fs.writeFileSync(file, '﻿' + lines.join('\n') + '\n'); // BOM — щоб Excel відкривав кирилицю
}

(async () => {
  const token = await getAccessToken();

  // Ресурс може бути доданий як домен (sc-domain:) або як URL-префікс — шукаємо будь-який.
  const sitesResp = await api(token, 'https://www.googleapis.com/webmasters/v3/sites');
  const sites = (sitesResp.siteEntry || []).map((s) => s.siteUrl);
  const site = sites.find((s) => s.includes(SITE_MATCH));
  if (!site) {
    console.error('Ресурс "' + SITE_MATCH + '" не знайдено. Сервісному акаунту доступні: ' +
      (sites.length ? sites.join(', ') : 'ЖОДНОГО — перевірте, що email акаунта доданий у Search Console (Налаштування → Користувачі)'));
    process.exit(1);
  }
  console.log('Ресурс:', site);

  // Останній повний тиждень з поправкою на затримку даних GSC (~3 дні).
  const end = new Date(Date.now() - 3 * 86400000);
  const start = new Date(end.getTime() - 6 * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const startDate = fmt(start);
  const endDate = fmt(end);
  console.log('Період:', startDate, '→', endDate);

  const outDir = path.join(ROOT, 'seo-data', 'gsc', endDate);
  fs.mkdirSync(outDir, { recursive: true });

  // Той самий хост, що й список ресурсів вище — він точно доступний з раннера.
  const queryUrl = 'https://www.googleapis.com/webmasters/v3/sites/' +
    encodeURIComponent(site) + '/searchAnalytics/query';

  const slices = [
    { name: 'queries', dimensions: ['query'], limit: 5000 },
    { name: 'pages', dimensions: ['page'], limit: 5000 },
    { name: 'query-page', dimensions: ['query', 'page'], limit: 10000 },
    { name: 'dates', dimensions: ['date'], limit: 1000 },
  ];

  const summary = { site, startDate, endDate, exportedAt: new Date().toISOString(), slices: {} };

  for (const s of slices) {
    const resp = await api(token, queryUrl, {
      startDate, endDate,
      dimensions: s.dimensions,
      rowLimit: s.limit,
      dataState: 'final',
    });
    const rows = resp.rows || [];
    writeCsv(
      path.join(outDir, s.name + '.csv'),
      [...s.dimensions, 'clicks', 'impressions', 'ctr_percent', 'position'],
      rows,
      s.dimensions.length
    );
    const totals = rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }),
      { clicks: 0, impressions: 0 });
    summary.slices[s.name] = { rows: rows.length, ...totals };
    console.log(s.name + ': рядків ' + rows.length + ', кліків ' + totals.clicks + ', показів ' + totals.impressions);
  }

  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('Готово:', path.relative(ROOT, outDir));
})().catch((e) => {
  console.error(e.message || e);
  if (e && e.cause) console.error('Причина:', e.cause);
  process.exit(1);
});
