/*
  common.js — спільна логіка для ВСІХ сторінок сайту: мобільне меню,
  кошик (зберігається в localStorage браузера, без бекенду).

  Як підключити на новій сторінці: build.js вставляє цей файл автоматично
  (тег <script src="/assets/js/common.js" defer>) в кожну зібрану сторінку —
  вручну підключати нічого не треба.

  Публічне API для інших скриптів сторінки (наприклад menu.js):
    window.PandaCart.add({ id, name, price, img })
  Кнопки з атрибутом data-add-to-cart обробляються тут
  автоматично через делегування подій — власний JS писати не обов'язково.
*/
(function () {
  'use strict';

  var CART_KEY = 'ps_cart_v1';

  // ---------- Допоміжні функції для роботи з localStorage ----------
  // localStorage може бути недоступний (приватний режим Safari тощо) —
  // тому кожен виклик обгорнутий у try/catch, щоб сторінка не ламалась.
  function readStore(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* сховище недоступне — тихо ігноруємо, працюємо в межах сесії */
    }
  }
  function formatUAH(n) {
    return Math.round(n).toLocaleString('uk-UA') + ' ₴';
  }
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  // ================= КОШИК =================
  var cartItems = readStore(CART_KEY);

  function saveCart() {
    writeStore(CART_KEY, cartItems);
    window.dispatchEvent(new CustomEvent('ps:cart-change', { detail: { items: cartItems } }));
  }

  var PandaCart = {
    add: function (product, qty) {
      qty = qty || 1;
      var existing = cartItems.find(function (i) { return i.id === product.id; });
      if (existing) {
        existing.qty += qty;
      } else {
        cartItems.push({
          id: product.id,
          name: product.name,
          price: Number(product.price) || 0,
          img: product.img || '',
          qty: qty
        });
      }
      saveCart();
    },
    setQty: function (id, qty) {
      qty = Math.max(0, qty);
      if (qty === 0) return PandaCart.remove(id);
      var item = cartItems.find(function (i) { return i.id === id; });
      if (item) { item.qty = qty; saveCart(); }
    },
    remove: function (id) {
      cartItems = cartItems.filter(function (i) { return i.id !== id; });
      saveCart();
    },
    clear: function () {
      cartItems = [];
      saveCart();
    },
    getAll: function () { return cartItems.slice(); },
    getCount: function () { return cartItems.reduce(function (n, i) { return n + i.qty; }, 0); },
    getTotal: function () { return cartItems.reduce(function (n, i) { return n + i.qty * i.price; }, 0); }
  };
  window.PandaCart = PandaCart;

  // ================= РЕНДЕР ІНДИКАТОРІВ У ШАПЦІ =================
  function renderHeaderBadges() {
    var cartBadge = document.getElementById('cartBadge');
    var cartTotal = document.getElementById('cartTotal');
    var mobileCartBadge = document.getElementById('mobileCartBadge');
    var count = PandaCart.getCount();
    if (cartBadge) {
      cartBadge.textContent = String(count);
      cartBadge.hidden = count === 0;
    }
    if (cartTotal) cartTotal.textContent = formatUAH(PandaCart.getTotal());
    // Бейдж кількості на кнопці "Кошик" нижньої мобільної панелі —
    // той самий рахунок, що й у шапці (.mobile-tabbar, mobile-tabbar.css).
    if (mobileCartBadge) {
      mobileCartBadge.textContent = String(count);
      mobileCartBadge.hidden = count === 0;
    }
  }

  // ================= ШУХЛЯДА КОШИКА (drawer) =================
  function renderCartDrawer() {
    var body = document.getElementById('cartDrawerBody');
    var foot = document.getElementById('cartDrawerFoot');
    if (!body || !foot) return;
    var items = PandaCart.getAll();

    if (items.length === 0) {
      body.innerHTML = '<p class="drawer__empty">Кошик порожній. Додайте страви з меню.</p>';
      foot.innerHTML = '<a href="/menu.html" class="btn btn-primary" style="width:100%">Перейти до меню</a>';
      return;
    }

    body.innerHTML = items.map(function (item) {
      return (
        '<div class="drawer-item" data-id="' + escapeHtml(item.id) + '">' +
        (item.img ? '<img class="drawer-item__img" src="' + escapeHtml(item.img) + '" alt="" width="56" height="56" loading="lazy">' : '') +
        '<div class="drawer-item__info">' +
        '<span class="drawer-item__name">' + escapeHtml(item.name) + '</span>' +
        '<span class="drawer-item__price">' + formatUAH(item.price) + '</span>' +
        '</div>' +
        '<div class="drawer-item__qty">' +
        '<button type="button" class="qty-btn" data-qty-down aria-label="Зменшити кількість">−</button>' +
        '<span aria-live="polite">' + item.qty + '</span>' +
        '<button type="button" class="qty-btn" data-qty-up aria-label="Збільшити кількість">+</button>' +
        '</div>' +
        '<button type="button" class="drawer-item__remove" data-remove aria-label="Прибрати ' + escapeHtml(item.name) + ' з кошика">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
        '</button>' +
        '</div>'
      );
    }).join('');

    foot.innerHTML =
      '<div class="drawer-total"><span>Разом</span><strong>' + formatUAH(PandaCart.getTotal()) + '</strong></div>' +
      '<a class="btn btn-primary" style="width:100%" href="/checkout.html">Оформити замовлення</a>';
  }

  function refreshAll() {
    renderHeaderBadges();
    renderCartDrawer();
  }

  // ================= ВІДКРИТТЯ/ЗАКРИТТЯ ШУХЛЯД =================
  var lastFocused = null;
  function openDrawer(drawer) {
    if (!drawer) return;
    lastFocused = document.activeElement;
    drawer.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = drawer.querySelector('.drawer__close, .mega-menu__close');
    if (closeBtn) closeBtn.focus();
  }
  function closeDrawer(drawer) {
    if (!drawer) return;
    drawer.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  function closeAllDrawers() {
    document.querySelectorAll('.drawer').forEach(closeDrawer);
  }

  // Публічний доступ для інших скриптів сторінки (наприклад product-details.js),
  // щоб не дублювати логіку фокуса/блокування скролу для власних .drawer-елементів.
  window.PandaDrawer = { open: openDrawer, close: closeDrawer };

  function readProductFromEl(el) {
    return {
      id: el.getAttribute('data-id'),
      name: el.getAttribute('data-name'),
      price: el.getAttribute('data-price'),
      img: el.getAttribute('data-img')
    };
  }

  // ================= ІНІЦІАЛІЗАЦІЯ ПІСЛЯ ЗАВАНТАЖЕННЯ DOM =================
  document.addEventListener('DOMContentLoaded', function () {
    // Рік у підвалі
    var yearEl = document.getElementById('copyrightYear');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    // Бургер-меню шапки (мобільне, <861px): відкриває поп-ап "Головне меню"
    // (#navDrawer) поверх контенту — той самий openDrawer/closeDrawer, що й
    // у категорій/кошика, замість колишнього списку, що розсував сторінку.
    var burger = document.getElementById('burgerButton');
    var navDrawer = document.getElementById('navDrawer');
    if (burger) burger.addEventListener('click', function () { openDrawer(navDrawer); });

    // Підсвітити активний пункт меню за поточною сторінкою
    var current = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
    document.querySelectorAll('[data-nav]').forEach(function (link) {
      if (link.getAttribute('data-nav') === current) link.classList.add('is-active');
    });

    // Кнопка "Кошик" в шапці відкриває шухляду
    var cartBtn = document.getElementById('cartButton');
    var cartDrawer = document.getElementById('cartDrawer');
    if (cartBtn) cartBtn.addEventListener('click', function () { openDrawer(cartDrawer); });

    // Нижня мобільна панель (<861px): "Меню" відкриває категорії,
    // "Кошик" — той самий #cartDrawer, що й кнопка в шапці (на мобільному
    // шапкова кнопка кошика прихована в CSS — це єдине місце виклику).
    var mobileMenuBtn = document.getElementById('mobileMenuButton');
    var categoriesDrawer = document.getElementById('categoriesDrawer');
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', function () { openDrawer(categoriesDrawer); });

    var mobileCartBtn = document.getElementById('mobileCartButton');
    if (mobileCartBtn) mobileCartBtn.addEventListener('click', function () { openDrawer(cartDrawer); });

    document.querySelectorAll('[data-drawer-close]').forEach(function (el) {
      el.addEventListener('click', function () { closeDrawer(el.closest('.drawer')); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllDrawers();
    });

    // Делегування кліків: додати в кошик / +−/ видалити
    document.addEventListener('click', function (e) {
      var addBtn = e.target.closest('[data-add-to-cart]');
      if (addBtn) {
        PandaCart.add(readProductFromEl(addBtn));
        // Кругла кнопка (46×46, лише "+") замалá для тексту "Додано ✓" —
        // він вилазив за межі кружка. Замість тексту — галочка й зелений фон,
        // той самий розмір/центрування, що й у "+".
        var label = addBtn.querySelector('[data-add-label]') || addBtn;
        var original = label.textContent;
        label.textContent = '✓';
        addBtn.classList.add('is-added');
        setTimeout(function () {
          label.textContent = original;
          addBtn.classList.remove('is-added');
        }, 1200);
        return;
      }

      var qtyUp = e.target.closest('[data-qty-up]');
      if (qtyUp) {
        var rowUp = qtyUp.closest('.drawer-item');
        var itemUp = PandaCart.getAll().find(function (i) { return i.id === rowUp.dataset.id; });
        if (itemUp) PandaCart.setQty(itemUp.id, itemUp.qty + 1);
        return;
      }
      var qtyDown = e.target.closest('[data-qty-down]');
      if (qtyDown) {
        var rowDown = qtyDown.closest('.drawer-item');
        var itemDown = PandaCart.getAll().find(function (i) { return i.id === rowDown.dataset.id; });
        if (itemDown) PandaCart.setQty(itemDown.id, itemDown.qty - 1);
        return;
      }
      var removeBtn = e.target.closest('[data-remove]');
      if (removeBtn) {
        PandaCart.remove(removeBtn.closest('.drawer-item').dataset.id);
        return;
      }
    });

    window.addEventListener('ps:cart-change', refreshAll);

    refreshAll();
  });
})();
