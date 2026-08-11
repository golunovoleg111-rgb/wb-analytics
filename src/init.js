// ============================================================
// BELTANEE v6.1 — ИНИЦИАЛИЗАЦИЯ
// ============================================================

import ProductService from './services/ProductService.js';
import SalesService from './services/SalesService.js';
import StockService from './services/StockService.js';
import Database from './infrastructure/db.js';

function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function ensureProfilePage() {
    if (document.getElementById('page-profile')) return;
    const section = document.createElement('section');
    section.id = 'page-profile';
    section.className = 'page';
    section.innerHTML = `
        <div class="page-header"><h1>👤 Личный кабинет</h1><span style="font-size:12px;color:var(--text-secondary);">Локальный профиль BELTANEE</span></div>
        <div class="grid-3">
            <div class="card"><div class="card-title">Профиль</div><div class="form-group"><label>Имя</label><input id="profileName" type="text" placeholder="Ваше имя"></div><div class="form-group"><label>Название бизнеса</label><input id="profileBusiness" type="text" placeholder="Название магазина"></div><button class="btn btn-primary" id="saveProfileBtn">💾 Сохранить</button></div>
            <div class="card"><div class="card-title">Хранилище</div><div id="profileStorageInfo" style="font-size:13px;color:var(--text-secondary);">Загрузка…</div></div>
            <div class="card"><div class="card-title">Безопасность данных</div><div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">Все данные BELTANEE v6.1 хранятся локально в IndexedDB браузера. Данные не отправляются на сервер.</div></div>
        </div>`;
    document.querySelector('main.content')?.appendChild(section);

    const profile = JSON.parse(localStorage.getItem('beltanee-profile') || '{}');
    const name = document.getElementById('profileName');
    const business = document.getElementById('profileBusiness');
    if (name) name.value = profile.name || '';
    if (business) business.value = profile.business || '';

    document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
        localStorage.setItem('beltanee-profile', JSON.stringify({ name: name?.value || '', business: business?.value || '' }));
        window.showToast?.('Профиль сохранён', 'success');
    });

    Promise.all([
        Database.count(Database.STORES.PRODUCTS),
        Database.count(Database.STORES.SALES),
        Database.count(Database.STORES.STOCK),
        Database.count(Database.STORES.ADVERTISING)
    ]).then(([products, sales, stock, ads]) => {
        const el = document.getElementById('profileStorageInfo');
        if (el) el.innerHTML = `Товары: <strong>${products}</strong><br>Продажи: <strong>${sales}</strong><br>Остатки: <strong>${stock}</strong><br>Реклама: <strong>${ads}</strong>`;
    }).catch(() => {});
}

function patchProfileButton() {
    const button = document.getElementById('profileBtn');
    if (!button || button.dataset.beltaneePatched) return;

    const replacement = button.cloneNode(true);
    replacement.dataset.beltaneePatched = '1';
    replacement.addEventListener('click', () => {
        ensureProfilePage();
        window.navigateTo?.('profile');
    });
    button.replaceWith(replacement);
}

async function checkArchitecture() {
    try {
        const [products, sales, stock] = await Promise.all([
            ProductService.getAll(),
            SalesService.getAll(),
            StockService.getAllAggregated()
        ]);
        console.log('[BELTANEE v6.1] База готова:', {
            products: products.length,
            sales: sales.length,
            stockProducts: Object.keys(stock).length,
            database: Database.DB_NAME
        });
        return true;
    } catch (error) {
        console.error('[BELTANEE v6.1] Ошибка инициализации:', error);
        return false;
    }
}

async function init() {
    document.title = 'BELTANEE v6.1 — Аналитика бизнеса на Wildberries';
    document.querySelector('.logo-text')?.replaceChildren(document.createTextNode('BELTANEE'));
    const badge = document.querySelector('.logo-badge');
    if (badge) badge.textContent = 'v6.1';

    ensureProfilePage();
    patchProfileButton();
    await checkArchitecture();
    console.log('✅ BELTANEE v6.1 готов');
}

init();

export { checkArchitecture, ensureProfilePage };
