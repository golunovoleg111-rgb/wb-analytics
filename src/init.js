// ============================================================
// BELTANEE v6.1 — ИНИЦИАЛИЗАЦИЯ
// ============================================================

import ProductService from './services/ProductService.js';
import SalesService from './services/SalesService.js';
import StockService from './services/StockService.js';
import Database from './infrastructure/db.js';
import { installV61Pages } from './ui/v61AnalyticsPages.js';
import { showLoading, setLoadingMessage, hideLoading } from './ui/loadingScreen.js';

function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function collectBackup() {
    const backup = { version: '6.1', createdAt: new Date().toISOString(), database: Database.DB_NAME, stores: {} };
    for (const storeName of Object.values(Database.STORES)) {
        try { backup.stores[storeName] = await Database.getAll(storeName); } catch { backup.stores[storeName] = []; }
    }
    return backup;
}

function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ensureProfilePage() {
    if (document.getElementById('page-profile')) return;
    const section = document.createElement('section');
    section.id = 'page-profile';
    section.className = 'page';
    section.innerHTML = `
        <div class="page-header"><h1>👤 Личный кабинет</h1><span style="font-size:12px;color:var(--text-secondary);">Локальный профиль BELTANEE v6.1</span></div>
        <div class="grid-3">
            <div class="card"><div class="card-title">Профиль</div><div class="form-group"><label>Имя</label><input id="profileName" type="text" placeholder="Ваше имя"></div><div class="form-group"><label>Название бизнеса</label><input id="profileBusiness" type="text" placeholder="Название магазина"></div><button class="btn btn-primary" id="saveProfileBtn">💾 Сохранить</button></div>
            <div class="card"><div class="card-title">Хранилище</div><div id="profileStorageInfo" style="font-size:13px;color:var(--text-secondary);">Загрузка…</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;"><button class="btn btn-secondary btn-sm" id="backupDataBtn">⬇️ Резервная копия</button><button class="btn btn-danger btn-sm" id="resetDataBtn">🗑️ Очистить v6.1</button></div></div>
            <div class="card"><div class="card-title">Безопасность данных</div><div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">Данные BELTANEE v6.1 хранятся локально в IndexedDB браузера. Они не отправляются на сервер.</div><div style="margin-top:12px;font-size:12px;color:var(--text-secondary);">База: ${escapeHtml(Database.DB_NAME)}</div></div>
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

    document.getElementById('backupDataBtn')?.addEventListener('click', async () => {
        try { downloadJson(`beltanee-v6.1-backup-${new Date().toISOString().slice(0, 10)}.json`, await collectBackup()); window.showToast?.('Резервная копия создана', 'success'); }
        catch (error) { window.showToast?.(`Ошибка резервной копии: ${error.message}`, 'error'); }
    });

    document.getElementById('resetDataBtn')?.addEventListener('click', async () => {
        if (!confirm('Очистить ВСЕ данные BELTANEE v6.1? Это действие нельзя отменить.')) return;
        for (const storeName of Object.values(Database.STORES)) { try { await Database.clear(storeName); } catch {} }
        window.showToast?.('Данные v6.1 очищены. Можно импортировать отчёты заново.', 'success');
        setTimeout(() => window.location.reload(), 600);
    });

    Promise.all([Database.count(Database.STORES.PRODUCTS), Database.count(Database.STORES.SALES), Database.count(Database.STORES.STOCK), Database.count(Database.STORES.ADVERTISING)]).then(([products, sales, stock, ads]) => {
        const el = document.getElementById('profileStorageInfo');
        if (el) el.innerHTML = `Товары: <strong>${products}</strong><br>Продажи: <strong>${sales}</strong><br>Остатки: <strong>${stock}</strong><br>Реклама: <strong>${ads}</strong>`;
    }).catch(() => {});
}

function patchProfileButton() {
    const button = document.getElementById('profileBtn');
    if (!button || button.dataset.beltaneePatched) return;
    const replacement = button.cloneNode(true);
    replacement.dataset.beltaneePatched = '1';
    replacement.addEventListener('click', () => { ensureProfilePage(); window.navigateTo?.('profile'); });
    button.replaceWith(replacement);
}

async function checkArchitecture() {
    setLoadingMessage('Проверяем локальное хранилище…');
    try {
        const [products, sales, stock] = await Promise.all([ProductService.getAll(), SalesService.getAll(), StockService.getAllAggregated()]);
        console.log('[BELTANEE v6.1] База готова:', { products: products.length, sales: sales.length, stockProducts: Object.keys(stock).length, database: Database.DB_NAME });
        return true;
    } catch (error) {
        console.error('[BELTANEE v6.1] Ошибка инициализации:', error);
        window.showToast?.(`Ошибка базы данных: ${error.message}`, 'error');
        return false;
    }
}

async function init() {
    showLoading('Запускаем BELTANEE…');
    document.title = 'BELTANEE v6.1 — Аналитика бизнеса на Wildberries';
    document.querySelector('.logo-text')?.replaceChildren(document.createTextNode('BELTANEE'));
    const badge = document.querySelector('.logo-badge');
    if (badge) badge.textContent = 'v6.1';
    ensureProfilePage();
    patchProfileButton();
    setLoadingMessage('Загружаем разделы аналитики…');
    installV61Pages();
    const ready = await checkArchitecture();
    setLoadingMessage(ready ? 'Рабочее пространство готово' : 'Завершение запуска…');
    await new Promise(resolve => setTimeout(resolve, ready ? 350 : 700));
    hideLoading();
    console.log('✅ BELTANEE v6.1 готов');
}

init();

export { checkArchitecture, ensureProfilePage };
