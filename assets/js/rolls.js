/*
  rolls.js — сортування й фільтрація каталогу на /rolls.html.
  Дані про товар читаються прямо з data-атрибутів картки (без бекенду).
  Підключається лише на цій сторінці (frontmatter: js: rolls).
*/
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.product-card'));
    const foundEl = document.getElementById('catalogFound');
    const sortButtons = document.querySelectorAll('[data-sort]');
    const filterChips = document.querySelectorAll('[data-filter]');

    let activeFilter = 'all';

    function applyFilter() {
      let visible = 0;
      cards.forEach((card) => {
        const tag = card.getAttribute('data-tag');
        const show = activeFilter === 'all' || tag === activeFilter;
        card.hidden = !show;
        if (show) visible++;
      });
      if (foundEl) foundEl.textContent = String(visible);
    }

    function applySort(mode) {
      const sorted = cards.slice().sort((a, b) => {
        const priceA = Number(a.getAttribute('data-price'));
        const priceB = Number(b.getAttribute('data-price'));
        const ratingA = Number(a.getAttribute('data-rating'));
        const ratingB = Number(b.getAttribute('data-rating'));
        const votesA = Number(a.getAttribute('data-votes'));
        const votesB = Number(b.getAttribute('data-votes'));
        if (mode === 'price-asc') return priceA - priceB;
        if (mode === 'price-desc') return priceB - priceA;
        if (mode === 'rating') return ratingB - ratingA;
        return votesB - votesA; // popular (default)
      });
      sorted.forEach((card) => grid.appendChild(card));
    }

    sortButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        sortButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        applySort(btn.getAttribute('data-sort'));
      });
    });

    filterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        filterChips.forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        activeFilter = chip.getAttribute('data-filter');
        applyFilter();
      });
    });

    applyFilter();
  });
})();
