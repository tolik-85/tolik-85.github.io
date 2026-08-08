/*
  checkout.js — 6-кроковий (5 при самовивозі — крок "Адреса" пропускається)
  візард оформлення замовлення (/checkout.html). Кошик читається з
  window.PandaCart (localStorage, common.js), прогрес заповнення форми —
  з sessionStorage (переживає F5 у межах сесії, не "воскресає" в новій).

  Підтвердження замовлення (handleSubmit нижче) реально надсилає зібрані
  у `state` дані на /api/send-to-telegram.php (PHP-релей у Telegram, див.
  api/send-to-telegram.php і api/telegram-config.php) — і лише після
  успішної відповіді сервера показує екран-підтвердження та очищає кошик.
  Той самий підхід, що й у forms.js (data-form-type + fetch).
*/
(function () {
  'use strict';

  // Локальні хелпери — formatUAH/escapeHtml приватні в common.js (не на
  // window), тому дублюємо тут маленькими, як уже зроблено в product-details.js.
  function formatUAH(n) { return Math.round(n).toLocaleString('uk-UA') + ' ₴'; }
  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = String(str == null ? '' : str);
    return d.innerHTML;
  }

  var STORAGE_KEY = 'ps_checkout_v1';
  var MIN_ORDER = 350; // /delivery.html — мінімальне замовлення (тільки доставка)
  var PICKUP_DISCOUNT = 0.10; // /header.html topbar: "Самовивіз ... знижка −10%"

  // Єдина вартість доставки по місту й поріг безкоштовної — /promotions.html:
  // "Безкоштовна доставка. Від 600 ₴ у межах Одеси" (без прив'язки до району).
  var DELIVERY_FEE = 79;
  var FREE_DELIVERY_FROM = 600;

  var STEP_LABELS = {
    fulfillment: 'Отримання', contacts: 'Контакти', address: 'Адреса',
    time: 'Час', payment: 'Оплата', review: 'Перевірка'
  };

  document.addEventListener('DOMContentLoaded', function () {
    var wizard = document.getElementById('checkoutWizard');
    if (!wizard) return; // не сторінка чекауту

    var emptyState = document.getElementById('checkoutEmpty');
    var cartItems = window.PandaCart ? window.PandaCart.getAll() : [];
    if (!cartItems.length) {
      if (emptyState) emptyState.hidden = false;
      return;
    }
    wizard.hidden = false;

    var cartTotal = window.PandaCart.getTotal();
    var head = document.getElementById('checkoutHead');
    var backBtn = document.getElementById('checkoutBack');
    var stepLabelEl = document.getElementById('checkoutStepLabel');
    var progressEl = document.getElementById('checkoutProgress');

    var sections = {};
    document.querySelectorAll('.checkout-step[data-step]').forEach(function (s) {
      sections[s.getAttribute('data-step')] = s;
    });

    // ---------- Поля ----------
    var fulfillmentRadios = wizard.querySelectorAll('input[name="fulfillment"]');
    var phoneInput = document.getElementById('checkoutPhone');
    var nameInput = document.getElementById('checkoutName');
    var streetInput = document.getElementById('checkoutStreet');
    var aptInput = document.getElementById('checkoutApt');
    var entranceInput = document.getElementById('checkoutEntrance');
    var floorInput = document.getElementById('checkoutFloor');
    var intercomInput = document.getElementById('checkoutIntercom');
    var commentInput = document.getElementById('checkoutComment');
    var mapAddrEl = document.getElementById('checkoutMapAddr');
    var timeModeRadios = wizard.querySelectorAll('input[name="timeMode"]');
    var scheduleRow = document.getElementById('checkoutScheduleRow');
    var dateInput = document.getElementById('checkoutDate');
    var timeInput = document.getElementById('checkoutTime');
    var personsRow = document.getElementById('checkoutPersonsRow');
    var paymentRadios = wizard.querySelectorAll('input[name="payment"]');
    var cashRow = document.getElementById('checkoutCashRow');
    var changeFromInput = document.getElementById('checkoutChangeFrom');
    var payTotalEl = document.getElementById('checkoutPayTotal');
    var minOrderBox = document.getElementById('checkoutMinOrder');
    var cartSumEl = document.getElementById('checkoutCartSum');
    var minOrderNoteEl = document.getElementById('checkoutMinOrderNote');
    var summaryEl = document.getElementById('checkoutSummary');
    var reviewListEl = document.getElementById('checkoutReviewList');
    var totalEl = document.getElementById('checkoutTotal');
    var submitBtn = document.getElementById('checkoutSubmitBtn');
    var submitErrorEl = document.getElementById('checkoutSubmitError');

    // ---------- Стан ----------
    var state = loadState();
    var stepStack = (state.__stack && state.__stack.length) ? state.__stack : ['fulfillment'];

    function loadState() {
      try {
        var raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* приватний режим тощо — тихо працюємо без відновлення */ }
      return {
        fulfillment: 'delivery', phone: '', name: '',
        street: '', apt: '', entrance: '', floor: '', intercom: '', comment: '',
        timeMode: 'asap', date: '', time: '', persons: 0,
        payment: 'cash', changeFrom: '',
        __stack: ['fulfillment']
      };
    }
    function saveState() {
      state.__stack = stepStack;
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function stepOrder() {
      return state.fulfillment === 'pickup'
        ? ['fulfillment', 'contacts', 'time', 'payment', 'review']
        : ['fulfillment', 'contacts', 'address', 'time', 'payment', 'review'];
    }
    function getDiscount() {
      return state.fulfillment === 'pickup' ? cartTotal * PICKUP_DISCOUNT : 0;
    }
    function getDeliveryFee() {
      if (state.fulfillment === 'pickup') return 0;
      return cartTotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
    }
    function getTotal() {
      var fee = getDeliveryFee();
      return cartTotal - getDiscount() + (fee || 0);
    }

    function setRadio(radios, value) {
      radios.forEach(function (r) { r.checked = r.value === value; });
      syncActiveCards(radios);
    }
    function syncActiveCards(radios) {
      radios.forEach(function (r) {
        var label = r.closest('.checkout-option');
        if (label) label.classList.toggle('is-active', r.checked);
      });
    }
    function setPersons(n) {
      state.persons = Number(n);
      personsRow.querySelectorAll('[data-persons]').forEach(function (btn) {
        btn.classList.toggle('is-active', Number(btn.getAttribute('data-persons')) === state.persons);
      });
    }

    // ---------- Заповнити поля з state (відновлення після F5) ----------
    setRadio(fulfillmentRadios, state.fulfillment);
    phoneInput.value = state.phone;
    nameInput.value = state.name;
    streetInput.value = state.street;
    aptInput.value = state.apt;
    entranceInput.value = state.entrance;
    floorInput.value = state.floor;
    intercomInput.value = state.intercom;
    commentInput.value = state.comment;
    setRadio(timeModeRadios, state.timeMode);
    dateInput.value = state.date;
    timeInput.value = state.time;
    setPersons(state.persons);
    setRadio(paymentRadios, state.payment);
    changeFromInput.value = state.changeFrom;

    // ---------- Рендер поточного кроку ----------
    function render() {
      var key = stepStack[stepStack.length - 1];

      if (key === 'done') {
        Object.keys(sections).forEach(function (k) { sections[k].hidden = k !== 'done'; });
        head.hidden = true;
        window.scrollTo(0, 0);
        return;
      }

      var order = stepOrder();
      var idx = order.indexOf(key);
      if (idx === -1) { key = order[0]; stepStack = [key]; idx = 0; }

      Object.keys(sections).forEach(function (k) { sections[k].hidden = k !== key; });
      head.hidden = false;
      backBtn.hidden = stepStack.length <= 1;
      stepLabelEl.textContent = 'Крок ' + (idx + 1) + ' з ' + order.length + ' · ' + STEP_LABELS[key];
      progressEl.innerHTML = order.map(function (_, i) {
        return '<span' + (i <= idx ? ' class="is-done"' : '') + '></span>';
      }).join('');

      if (key === 'fulfillment') renderMinOrder();
      if (key === 'address') renderMapAddr();
      if (key === 'time') {
        var scheduled = state.timeMode === 'scheduled';
        scheduleRow.hidden = !scheduled;
        dateInput.required = scheduled;
        timeInput.required = scheduled;
      }
      if (key === 'payment') {
        cashRow.hidden = state.payment !== 'cash';
        renderPayTotal();
      }
      if (key === 'review') renderReview();

      window.scrollTo(0, 0);
      saveState();
    }

    function renderMinOrder() {
      cartSumEl.textContent = formatUAH(cartTotal);
      var below = state.fulfillment === 'delivery' && cartTotal < MIN_ORDER;
      minOrderBox.classList.toggle('is-below', below);
      minOrderBox.classList.toggle('is-ok', !below);
      minOrderBox.hidden = state.fulfillment === 'pickup';
      if (state.fulfillment === 'pickup') {
        minOrderNoteEl.textContent = 'Самовивіз без мінімальної суми замовлення — і зі знижкою −10% на все замовлення.';
      } else if (below) {
        minOrderNoteEl.textContent = 'Додайте ще ' + formatUAH(MIN_ORDER - cartTotal) + ' до мінімального замовлення, щоб продовжити.';
      } else {
        minOrderNoteEl.textContent = 'Від цього вибору залежить, які поля будуть далі — адреса потрібна тільки для доставки.';
      }
    }

    function renderMapAddr() {
      mapAddrEl.textContent = state.street || 'Вкажіть вулицю нижче';
    }

    function renderPayTotal() {
      payTotalEl.textContent = 'Сума до сплати — ' + formatUAH(getTotal()) + (state.fulfillment === 'delivery' ? ' з доставкою.' : '.');
    }

    function renderReview() {
      var rows = cartItems.map(function (i) {
        return '<div class="checkout-summary__row"><span>' + escapeHtml(i.name) + ' × ' + i.qty + '</span><span>' + formatUAH(i.price * i.qty) + '</span></div>';
      }).join('');
      var discount = getDiscount();
      if (discount > 0) {
        rows += '<div class="checkout-summary__row is-discount"><span>Знижка за самовивіз −10%</span><span>−' + formatUAH(discount) + '</span></div>';
      }
      var fee = getDeliveryFee();
      rows += '<div class="checkout-summary__row"><span>Доставка</span><span>' +
        (state.fulfillment === 'pickup' ? 'самовивіз' : formatUAH(fee || 0)) + '</span></div>';
      summaryEl.innerHTML = rows;

      var addressText = state.fulfillment === 'pickup'
        ? 'Самовивіз · вул. Грецька, 12'
        : ((state.street || '—') + (state.apt ? ', кв. ' + state.apt : ''));
      var timeText = state.timeMode === 'asap'
        ? 'Якнайшвидше'
        : ('До ' + (state.date || '—') + ' ' + (state.time || '—'));
      var payText = state.payment === 'card'
        ? "Картою кур'єру"
        : ('Готівкою' + (state.changeFrom ? ', решта з ' + formatUAH(Number(state.changeFrom)) : ''));
      var personsText = state.persons > 0 ? ('На ' + state.persons + (state.persons >= 6 ? '+' : '') + ' персони') : 'Не потрібні';

      var reviewRows = [
        ['Куди', addressText, state.fulfillment === 'pickup' ? 'fulfillment' : 'address'],
        ['Коли', timeText, 'time'],
        ['Оплата', payText, 'payment'],
        ['Телефон', state.phone || '—', 'contacts'],
        ['Прибори', personsText, 'time']
      ];
      reviewListEl.innerHTML = reviewRows.map(function (r) {
        return '<div class="checkout-review-row"><span class="checkout-review-row__label">' + r[0] + '</span>' +
          '<span class="checkout-review-row__value">' + escapeHtml(r[1]) + '</span>' +
          '<button type="button" class="checkout-review-row__edit" data-edit="' + r[2] + '">Змінити</button></div>';
      }).join('');

      totalEl.textContent = formatUAH(getTotal());
    }

    // ---------- Навігація ----------
    function goNext() {
      var key = stepStack[stepStack.length - 1];
      if (key === 'fulfillment' && state.fulfillment === 'delivery' && cartTotal < MIN_ORDER) {
        renderMinOrder();
        return;
      }
      if (key === 'review') { handleSubmit(); return; }
      var order = stepOrder();
      var next = order[order.indexOf(key) + 1];
      if (next) { stepStack.push(next); render(); }
    }
    function goBack() {
      if (stepStack.length > 1) { stepStack.pop(); render(); }
    }
    function goEdit(key) { stepStack.push(key); render(); }

    // ---------- Події ----------
    // Кожен крок — окрема <form> (див. коментар у checkout.html), але 'submit'
    // спливає — досить одного делегованого слухача на весь візард.
    wizard.addEventListener('submit', function (e) { e.preventDefault(); goNext(); });
    backBtn.addEventListener('click', goBack);

    fulfillmentRadios.forEach(function (r) {
      r.addEventListener('change', function () { state.fulfillment = r.value; syncActiveCards(fulfillmentRadios); saveState(); render(); });
    });
    timeModeRadios.forEach(function (r) {
      r.addEventListener('change', function () { state.timeMode = r.value; syncActiveCards(timeModeRadios); saveState(); render(); });
    });
    paymentRadios.forEach(function (r) {
      r.addEventListener('change', function () { state.payment = r.value; syncActiveCards(paymentRadios); saveState(); render(); });
    });

    phoneInput.addEventListener('input', function () { state.phone = phoneInput.value; saveState(); });
    nameInput.addEventListener('input', function () { state.name = nameInput.value; saveState(); });
    streetInput.addEventListener('input', function () { state.street = streetInput.value; renderMapAddr(); saveState(); });
    aptInput.addEventListener('input', function () { state.apt = aptInput.value; saveState(); });
    entranceInput.addEventListener('input', function () { state.entrance = entranceInput.value; saveState(); });
    floorInput.addEventListener('input', function () { state.floor = floorInput.value; saveState(); });
    intercomInput.addEventListener('input', function () { state.intercom = intercomInput.value; saveState(); });
    commentInput.addEventListener('input', function () { state.comment = commentInput.value; saveState(); });
    dateInput.addEventListener('input', function () { state.date = dateInput.value; saveState(); });
    timeInput.addEventListener('input', function () { state.time = timeInput.value; saveState(); });
    changeFromInput.addEventListener('input', function () { state.changeFrom = changeFromInput.value; renderPayTotal(); saveState(); });

    document.querySelectorAll('[data-comment-chip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var extra = btn.getAttribute('data-comment-chip');
        commentInput.value = commentInput.value ? commentInput.value + '; ' + extra : extra;
        state.comment = commentInput.value;
        saveState();
      });
    });
    personsRow.querySelectorAll('[data-persons]').forEach(function (btn) {
      btn.addEventListener('click', function () { setPersons(btn.getAttribute('data-persons')); saveState(); });
    });
    document.querySelectorAll('[data-change]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-change');
        changeFromInput.value = v === 'exact' ? '' : v;
        state.changeFrom = changeFromInput.value;
        renderPayTotal();
        saveState();
      });
    });
    reviewListEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-edit]');
      if (btn) goEdit(btn.getAttribute('data-edit'));
    });

    // ---------- Фінальний сабміт: реальна відправка в Telegram ----------
    function handleSubmit() {
      if (submitBtn.disabled) return; // захист від подвійного сабміту (напр. Enter у полі)
      if (submitErrorEl) submitErrorEl.hidden = true;
      submitBtn.disabled = true;
      var originalLabel = submitBtn.textContent;
      submitBtn.textContent = 'Надсилаємо…';

      var orderNum = String(Math.floor(1000 + Math.random() * 9000));
      var payload = {
        _type: 'order',
        order_num: orderNum,
        items_json: JSON.stringify(cartItems.map(function (i) {
          return { name: i.name, qty: i.qty, price: i.price };
        })),
        cart_total: cartTotal,
        discount: getDiscount(),
        delivery_fee: getDeliveryFee(),
        total: getTotal(),
        fulfillment: state.fulfillment,
        name: state.name,
        phone: state.phone,
        street: state.street,
        apt: state.apt,
        entrance: state.entrance,
        floor: state.floor,
        intercom: state.intercom,
        comment: state.comment,
        timeMode: state.timeMode,
        date: state.date,
        time: state.time,
        persons: state.persons,
        payment: state.payment,
        changeFrom: state.changeFrom
      };

      fetch('/api/send-to-telegram.php', { method: 'POST', body: new URLSearchParams(payload) })
        .then(function (res) { return res.json().catch(function () { return { ok: false }; }); })
        .then(function (data) {
          if (!data || !data.ok) { throw new Error(data && data.error || 'send_failed'); }

          document.getElementById('checkoutOrderNum').textContent = '№ ' + orderNum;
          document.getElementById('checkoutOrderItems').textContent = cartItems.map(function (i) {
            return i.name + ' × ' + i.qty;
          }).join(', ');
          if (window.PandaCart) window.PandaCart.clear();
          try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
          stepStack = ['done'];
          render();
        })
        .catch(function (err) {
          if (window.console) console.warn('checkout: send-to-telegram failed —', err);
          if (submitErrorEl) {
            submitErrorEl.hidden = false;
            submitErrorEl.textContent = "Не вдалося надіслати замовлення. Перевірте з'єднання й спробуйте ще раз, або зателефонуйте: 097 398 18 46.";
            submitErrorEl.focus({ preventScroll: false });
          }
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        });
    }

    render();
  });
})();
