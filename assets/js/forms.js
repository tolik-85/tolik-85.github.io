/*
  forms.js — спільна обробка форм сайту. Підключається на сторінках, де є
  <form data-stub-form>.

  Дві поведінки залежно від атрибута data-form-type:
  - є data-form-type="…" (contacts/careers/ask-chef) — форма реально
    надсилається через /api/send-to-telegram.php (PHP-релей у Telegram,
    див. api/send-to-telegram.php і api/telegram-config.php).
  - немає data-form-type (зараз лише "профіль" на /account.html — сторінка
    відверто позначена як демо з прикладними даними, там нема кого сповіщати
    в Telegram) — стара чесна заглушка без мережевого запиту.
*/
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // Чіп-групи одиночного вибору (наприклад «Куди відгукуєтесь» на
    // /careers.html, «Тема звернення» на /contacts.html): клік по кнопці
    // робить активною лише її, приховане поле передає значення у форму.
    document.querySelectorAll('.role-chip-row, .contact-topics').forEach(function (group) {
      var hiddenInput = group.parentElement.querySelector('input[type="hidden"]');
      var chips = group.querySelectorAll('.role-chip, .contact-topic');

      function selectChip(chip) {
        chips.forEach(function (c) {
          var active = c === chip;
          c.classList.toggle('is-active', active);
          c.setAttribute('aria-checked', String(active));
        });
        if (hiddenInput) hiddenInput.value = chip.textContent.trim();
      }

      chips.forEach(function (chip) {
        chip.addEventListener('click', function () { selectChip(chip); });
      });

      // form.reset() повертає приховане поле до початкового значення —
      // синхронізуємо візуально активний чіп з ним же.
      var form = group.closest('form');
      if (form && hiddenInput) {
        form.addEventListener('reset', function () {
          setTimeout(function () {
            for (var i = 0; i < chips.length; i++) {
              if (chips[i].textContent.trim() === hiddenInput.value) { selectChip(chips[i]); break; }
            }
          }, 0);
        });
      }
    });

    document.querySelectorAll('form[data-stub-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Honeypot: приховане поле, яке заповнюють тільки боти-автозаповнювачі.
        var honeypot = form.querySelector('[data-honeypot]');
        if (honeypot && honeypot.value) return;

        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        // На /account.html [data-form-status] лежить усередині <form>, а на
        // /contacts.html, /careers.html, /blog.html — одразу після </form>
        // (сиблінг у тому самому блоці) — шукаємо в обох місцях.
        var status = form.querySelector('[data-form-status]') ||
          (form.parentElement && form.parentElement.querySelector('[data-form-status]'));
        var formType = form.getAttribute('data-form-type');

        // Немає data-form-type (демо-профіль на /account.html) — стара
        // заглушка без мережі, як і раніше.
        if (!formType) {
          if (status) {
            status.hidden = false;
            status.textContent = form.getAttribute('data-success-message') ||
              'Дякуємо! Онлайн-відправлення форм ще в розробці — зателефонуйте 097 398 18 46 або напишіть на hi@pandasushi.od.ua, і ми відповімо особисто.';
            status.focus({ preventScroll: false });
          }
          form.reset();
          return;
        }

        // Є data-form-type — реальна відправка на /api/send-to-telegram.php.
        var submitBtn = form.querySelector('[type="submit"]');
        var submitBtnLabel = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Надсилаємо…'; }

        var body = new FormData(form);
        body.append('_type', formType);

        fetch('/api/send-to-telegram.php', { method: 'POST', body: body })
          .then(function (res) { return res.json().catch(function () { return { ok: false }; }); })
          .then(function (data) {
            if (!status) return;
            status.hidden = false;
            if (data && data.ok) {
              status.textContent = form.getAttribute('data-success-message') ||
                'Дякуємо! Ми отримали ваше повідомлення.';
              form.reset();
            } else {
              status.textContent = 'Не вдалося надіслати форму. Зателефонуйте нам: 097 398 18 46, або спробуйте ще раз.';
            }
            status.focus({ preventScroll: false });
          })
          .catch(function () {
            if (status) {
              status.hidden = false;
              status.textContent = 'Не вдалося надіслати форму — перевірте з\'єднання й спробуйте ще раз, або зателефонуйте: 097 398 18 46.';
              status.focus({ preventScroll: false });
            }
          })
          .finally(function () {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtnLabel; }
          });
      });
    });
  });
})();
