/*
  article.js — кнопка "Копіювати посилання" у блоці "Поділитись" на /article.html.
*/
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('copyLinkBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var url = window.location.href;
      var original = btn.textContent;
      function done(text) {
        btn.textContent = text;
        setTimeout(function () { btn.textContent = original; }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done('Скопійовано ✓'); }, function () { done(url); });
      } else {
        done(url);
      }
    });
  });
})();
