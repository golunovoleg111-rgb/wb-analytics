// ============================================================
// BELTANEE v6.1 — ДОПОЛНИТЕЛЬНЫЕ РАБОЧИЕ СТРАНИЦЫ
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';
import AdvertisingService from '../services/AdvertisingService.js';
import Database from '../infrastructure/db.js';

const money = value => `${Math.round(Number(value) || 0).toLocaleString('ru-RU')} ₽`;
const qty = value => Math.round(Number(value) || 0).toLocaleString('ru-RU');
const norm = value => String(value ?? '').trim().toLowerCase();

function shell(title, subtitle, body) {
    return `<div class="page-header"><div><h1>${title}</h1><div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${subtitle}</div></div><button class="btn btn-secondary btn-sm" onclick="window.refreshV61Page?.()">🔄 Обновить</button></div>${body}`;
}
function empty(message) { return `<div class="card" style="padding:40px;text-align:center;color:var(--text-secondary);">${message}</div>`; }

function metricFor(map, product) {
    const keys = [product.articleKey, product.id, product.article, product.baseModel].map(norm).filter(Boolean);
    for (const key of keys) if (map[key]) return map[key];
    return null;
}

async function priceManagement() {
    const products = await ProductService.getActive();
    const rows = products.map(product => `<tr><td>${product.article}</td><td>${product.name || ''}</td><td>${money(product.price)}</td><td>${Number(product.discount || 0).toFixed(1)}%</td><td><button class="btn btn-secondary btn-sm" onclick="window.editV61Price('${String(product.id).replaceAll("'", "\\'")}')">Изменить</button></td></tr>`).join('');
    return shell('💰 Управление ценами', 'Текущие цены из импортированной номенклатуры', `<div class="card"><div style="overflow:auto"><table><thead><tr><th>Артикул</th><th>Название</th><th>Цена</th><th>Скидка</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5">Нет товаров</td></tr>'}</tbody></table></div></div>`);
}

async function stockAnalytics() {
    const stock = await StockService.getAllAggregated();
    const sales = await SalesService.getAllAggregated(30);
    const rows = Object.entries(stock).map(([productId, data]) => {
        const sold = Number(sales[productId]?.orders) || 0;
        const io = sold ? data.available / sold : null;
        const warehouses = Object.entries(data.byWarehouse || {}).sort((a, b) => b[1].available - a[1].available).map(([name, value]) => `${name}: ${qty(value.available)}`).join('<br>');
        return `<tr><td>${productId}</td><td>${qty(data.available)}</td><td>${qty(sold)}</td><td>${io === null ? '—' : io.toFixed(2)}</td><td>${warehouses || '—'}</td></tr>`;
    }).join('');
    const totalStock = Object.values(stock).reduce((s, x) => s + (Number(x.available) || 0), 0);
    const totalSales = Object.values(sales).reduce((s, x) => s + (Number(x.orders) || 0), 0);
    const warehouses = await StockService.getWarehouses();
    return shell('📊 Аналитика остатков', 'Остаток, продажи за 30 дней и оборачиваемость', `<div class="grid-3" style="margin-bottom:16px;"><div class="kpi-card"><div class="kpi-icon">📦</div><div class="kpi-info"><span class="kpi-label">Доступный остаток</span><span class="kpi-value">${qty(totalStock)}</span></div></div><div class="kpi-card"><div class="kpi-icon">🛒</div><div class="kpi-info"><span class="kpi-label">Заказы 30 дней</span><span class="kpi-value">${qty(totalSales)}</span></div></div><div class="kpi-card"><div class="kpi-icon">🏪</div><div class="kpi-info"><span class="kpi-label">Складов</span><span class="kpi-value">${warehouses.length}</span></div></div></div><div class="card"><div style="overflow:auto"><table><thead><tr><th>Товар</th><th>Остаток</th><th>Заказы 30д</th><th>ИО</th><th>Склады</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Нет данных</td></tr>'}</tbody></table></div></div>`);
}

async function salesSeasonality() {
    const sales = await SalesService.getAll();
    const byMonth = {};
    const byWeekday = {};
    for (const row of sales) {
        if (!row.date) continue;
        const date = new Date(`${row.date}T00:00:00`);
        const month = row.date.slice(0, 7);
        const weekday = date.toLocaleDateString('ru-RU', { weekday: 'long' });
        byMonth[month] = (byMonth[month] || 0) + (Number(row.orders) || 0);
        byWeekday[weekday] = (byWeekday[weekday] || 0) + (Number(row.orders) || 0);
    }
    const monthRows = Object.entries(byMonth).sort().map(([month, orders]) => `<tr><td>${month}</td><td>${qty(orders)}</td></tr>`).join('');
    const weekdayRows = Object.entries(byWeekday).sort((a, b) => b[1] - a[1]).map(([day, orders]) => `<tr><td style="text-transform:capitalize">${day}</td><td>${qty(orders)}</td></tr>`).join('');
    return shell('📅 Сезонность', 'Распределение заказов по месяцам и дням недели', `<div class="grid-2"><div class="card"><div class="card-title">По месяцам</div><table><thead><tr><th>Месяц</th><th>Заказы</th></tr></thead><tbody>${monthRows || '<tr><td colspan="2">Нет данных</td></tr>'}</tbody></table></div><div class="card"><div class="card-title">По дням недели</div><table><thead><tr><th>День</th><th>Заказы</th></tr></thead><tbody>${weekdayRows || '<tr><td colspan="2">Нет данных</td></tr>'}</tbody></table></div></div>`);
}

async function salesReports() {
    const sales = await SalesService.getAll();
    const rows = sales.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 500).map(row => `<tr><td>${row.date}</td><td>${row.article}</td><td>${qty(row.orders)}</td><td>${qty(row.delivered)}</td><td>${money(row.amount)}</td></tr>`).join('');
    return shell('📄 Отчёты по продажам', 'Последние 500 записей из локальной базы', `<div class="card"><div style="display:flex;gap:8px;margin-bottom:14px;"><button class="btn btn-primary btn-sm" onclick="window.exportV61Sales?.()">⬇️ Экспорт XLSX</button></div><div style="overflow:auto"><table><thead><tr><th>Дата</th><th>Артикул</th><th>Заказы</th><th>Выкупы</th><th>К перечислению</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Нет данных</td></tr>'}</tbody></table></div></div>`);
}

async function campaigns() {
    const campaigns = await AdvertisingService.getAll();
    const rows = campaigns.map(item => `<tr><td>${item.campaign || item.name || '—'}</td><td>${item.status || '—'}</td><td>${money(item.spent)}</td><td>${qty(item.orders)}</td><td>${Number(item.ctr || 0).toFixed(2)}%</td></tr>`).join('');
    return shell('📋 Кампании', 'Рекламные кампании из базы', `<div class="card"><div style="overflow:auto"><table><thead><tr><th>Кампания</th><th>Статус</th><th>Затраты</th><th>Заказы</th><th>CTR</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Нет рекламных данных</td></tr>'}</tbody></table></div></div>`);
}

async function promotionAnalytics() {
    const campaigns = await AdvertisingService.getAll();
    const spent = campaigns.reduce((s, x) => s + (Number(x.spent) || 0), 0);
    const orders = campaigns.reduce((s, x) => s + (Number(x.orders) || 0), 0);
    const clicks = campaigns.reduce((s, x) => s + (Number(x.clicks) || 0), 0);
    const cpc = clicks ? spent / clicks : 0;
    const cpo = orders ? spent / orders : 0;
    return shell('📊 Аналитика продвижения', 'Фактические показатели импортированных рекламных данных', `<div class="grid-4"><div class="kpi-card"><div class="kpi-icon">💸</div><div class="kpi-info"><span class="kpi-label">Расход</span><span class="kpi-value">${money(spent)}</span></div></div><div class="kpi-card"><div class="kpi-icon">🛒</div><div class="kpi-info"><span class="kpi-label">Заказы</span><span class="kpi-value">${qty(orders)}</span></div></div><div class="kpi-card"><div class="kpi-icon">🖱️</div><div class="kpi-info"><span class="kpi-label">CPC факт</span><span class="kpi-value">${money(cpc)}</span></div></div><div class="kpi-card"><div class="kpi-icon">🎯</div><div class="kpi-info"><span class="kpi-label">Стоимость заказа</span><span class="kpi-value">${money(cpo)}</span></div></div></div>`);
}

async function unitEconomics() {
    const products = await ProductService.getActive();
    const sales = await SalesService.getAllAggregated(30);
    const rows = products.map(product => {
        const price = Number(product.price) || 0;
        const purchase = Number(product.purchasePrice) || 0;
        const margin = price ? ((price - purchase) / price) * 100 : 0;
        const sale = metricFor(sales, product) || { orders: 0, revenue: 0 };
        return `<tr><td>${product.article}</td><td>${money(price)}</td><td>${money(purchase)}</td><td>${margin.toFixed(1)}%</td><td>${qty(sale.orders)}</td><td>${money(sale.revenue)}</td></tr>`;
    }).join('');
    return shell('💰 Юнит-экономика', 'Цена, себестоимость, маржа и продажи за 30 дней', `<div class="card"><div style="overflow:auto"><table><thead><tr><th>Артикул</th><th>Цена</th><th>Себестоимость</th><th>Маржа</th><th>Заказы 30д</th><th>Выручка 30д</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Нет данных</td></tr>'}</tbody></table></div></div>`);
}

async function wbStock() { return stockAnalytics(); }
async function stockAnalyticsDeep() { return stockAnalytics(); }
async function supplierStock() { return shell('📦 Склад поставщика', 'Контроль собственного склада', empty('Для этой вкладки нужен отдельный импорт остатков вашего склада. В v6.1 данные WB не смешиваются с данными собственного склада.')); }
async function externalAds() { return shell('🌐 Внешняя реклама', 'Ручной учёт внешних каналов', empty('Канал готов к подключению. Данные не выдумываются и появятся после импорта/ручного ввода.')); }

async function dataSettings() {
    const counts = await Promise.all(Object.entries(Database.STORES).map(async ([label, store]) => [label, await Database.count(store)]));
    const rows = counts.map(([label, count]) => `<tr><td>${label}</td><td>${count}</td></tr>`).join('');
    return shell('⚙️ Настройка данных', 'Контроль локальной базы v6.1', `<div class="card"><table><thead><tr><th>Хранилище</th><th>Записей</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:16px;color:var(--text-secondary);font-size:12px;">Повторный импорт одного типа отчёта заменяет соответствующий набор данных. Это защищает от накопления дублей.</div></div>`);
}

async function reports() {
    return shell('📄 Отчёты', 'Экспорт локальной аналитической базы', `<div class="grid-3"><div class="card"><div class="card-title">Продажи</div><div style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">Детальный экспорт продаж</div><button class="btn btn-primary btn-sm" onclick="window.exportV61Sales?.()">⬇️ Скачать XLSX</button></div><div class="card"><div class="card-title">JSON backup</div><div style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">Полная резервная копия локальной БД</div><button class="btn btn-primary btn-sm" onclick="window.openProfile?.()">👤 Открыть кабинет</button></div><div class="card"><div class="card-title">Контроль данных</div><div style="color:var(--text-secondary);font-size:13px;">Используйте «Настройка данных», чтобы проверить количество записей.</div></div></div>`);
}

export const pageRenderers = { 'price-management': priceManagement, 'stock-analytics': stockAnalytics, 'sales-seasonality': salesSeasonality, 'sales-reports': salesReports, 'campaigns': campaigns, 'promotion-analytics': promotionAnalytics, 'external-ads': externalAds, 'supplier-stock': supplierStock, 'wb-stock': wbStock, 'unit-economics': unitEconomics, 'stock-analytics-deep': stockAnalyticsDeep, 'data-settings': dataSettings, reports };

export async function renderV61Page(page) {
    const renderer = pageRenderers[page];
    if (!renderer) return;
    const element = document.getElementById(`page-${page}`);
    if (!element) return;
    try { element.innerHTML = await renderer(); } catch (error) { element.innerHTML = `<div class="card" style="padding:30px;color:#EF4444;">Ошибка страницы: ${error.message}</div>`; }
}

export function installV61Pages() {
    const originalNavigate = window.navigateTo;
    if (!originalNavigate || originalNavigate.__beltaneeV61) return;
    const navigate = function(page) {
        originalNavigate(page);
        if (page === 'profile') return;
        setTimeout(() => renderV61Page(page), 80);
    };
    navigate.__beltaneeV61 = true;
    window.navigateTo = navigate;

    window.refreshV61Page = () => {
        const active = document.querySelector('.page.active');
        if (active) renderV61Page(active.id.replace('page-', ''));
    };

    window.editV61Price = async id => {
        const product = await ProductService.getById(id);
        if (!product) return;
        const value = prompt(`Новая цена для ${product.article}`, String(product.price || 0));
        if (value === null) return;
        const price = Number(String(value).replace(',', '.'));
        if (!Number.isFinite(price) || price < 0) return window.showToast?.('Некорректная цена', 'error');
        await ProductService.update(id, { price });
        window.showToast?.('Цена сохранена', 'success');
        renderV61Page('price-management');
    };

    window.exportV61Sales = async () => {
        if (typeof XLSX === 'undefined') return;
        const sales = await SalesService.getAll();
        const rows = sales.map(row => ({ Дата: row.date, Артикул: row.article, Заказы: row.orders, Выкупы: row.delivered, Возвраты: row.returns, К_перечислению: row.amount, Сумма_заказов: row.totalAmount }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Продажи');
        XLSX.writeFile(workbook, `beltanee-sales-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    window.openProfile = () => { document.getElementById('profileBtn')?.click(); };
}
