// ============================================================
// PRODUCT CARD — BELTANEE v6.1
// Только реальные данные из IndexedDB. Никаких тестовых значений.
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';

let chartInstance = null;

const money = value => `${Math.round(Number(value) || 0).toLocaleString('ru-RU')} ₽`;
const qty = value => Math.round(Number(value) || 0).toLocaleString('ru-RU');

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
}

function baseArticle(value) {
    const parts = String(value ?? '').trim().split('_').filter(Boolean);
    if (parts.length <= 1) return normalize(value);
    const size = /^(\d{2,3}|XXS|XS|S|M|L|XL|XXL|XXXL)$/i;
    if (size.test(parts[parts.length - 1])) return normalize(parts.slice(0, -1).join('_'));
    return normalize(parts.slice(0, -1).join('_'));
}

function matchesProduct(row, product) {
    if (!row || !product) return false;
    const keys = [row.productId, row.articleKey, row.article].map(normalize).filter(Boolean);
    const productKeys = [product.id, product.articleKey, product.article].map(normalize).filter(Boolean);
    if (keys.some(key => productKeys.includes(key))) return true;
    return keys.some(key => key === baseArticle(product.article) || key === normalize(product.baseModel));
}

function isWithinLastDays(dateString, days = 30) {
    if (!dateString) return false;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const date = new Date(`${dateString}T00:00:00`);
    return date >= start && date <= end;
}

function getStockStatus(stock, sales30d) {
    if (stock <= 0) return { text: 'Нет остатков', color: '#6B7280' };
    if (sales30d <= 0) return { text: 'Нет продаж', color: '#6B7280' };
    const index = stock / sales30d;
    if (index < 0.2) return { text: 'Дефицит', color: '#EF4444' };
    if (index < 0.5) return { text: 'Недостаток', color: '#F59E0B' };
    if (index > 2) return { text: 'Избыток', color: '#3B82F6' };
    return { text: 'Норма', color: '#10B981' };
}

async function loadProductData(baseModel) {
    const variants = await ProductService.getByBaseModel(baseModel);
    if (!variants.length) return { error: 'Товар не найден', products: [] };

    const [stockAggregated, allSales] = await Promise.all([
        StockService.getAllAggregated(),
        SalesService.getAll()
    ]);

    // Один физический товар может иметь несколько размеров/цветов.
    // Собираем данные по вариантам, но каждую запись продаж считаем ровно один раз.
    const variantKeys = new Set(variants.map(p => normalize(p.articleKey)));
    const variantArticles = new Set(variants.map(p => normalize(p.article)));
    const variantBases = new Set(variants.map(p => normalize(p.baseModel || baseArticle(p.article))));

    let totalStock = 0;
    let totalSales = 0;
    let totalRevenue = 0;
    const stockByWarehouse = {};
    const salesByDate = {};
    const seenSales = new Set();

    for (const [key, aggregate] of Object.entries(stockAggregated || {})) {
        const normalizedKey = normalize(key);
        const belongs = variantKeys.has(normalizedKey) ||
            variantArticles.has(normalizedKey) ||
            variantBases.has(normalizedKey);
        if (!belongs) continue;

        totalStock += Number(aggregate.available) || 0;
        for (const [warehouse, value] of Object.entries(aggregate.byWarehouse || {})) {
            stockByWarehouse[warehouse] = (stockByWarehouse[warehouse] || 0) + (Number(value.available) || 0);
        }
    }

    for (const row of allSales || []) {
        if (!isWithinLastDays(row.date, 30)) continue;

        const rowArticle = normalize(row.article || row.productId);
        const rowProductId = normalize(row.productId);
        const belongs = variantKeys.has(rowProductId) ||
            variantArticles.has(rowArticle) ||
            variantBases.has(baseArticle(rowArticle));
        if (!belongs) continue;

        const uniqueId = row.id || `${rowProductId}|${row.date}`;
        if (seenSales.has(uniqueId)) continue;
        seenSales.add(uniqueId);

        const orders = Number(row.orders) || 0;
        const amount = Number(row.amount) || 0;
        totalSales += orders;
        totalRevenue += amount;

        if (row.date) {
            if (!salesByDate[row.date]) salesByDate[row.date] = { orders: 0, revenue: 0 };
            salesByDate[row.date].orders += orders;
            salesByDate[row.date].revenue += amount;
        }
    }

    const prices = variants.map(p => Number(p.price) || 0).filter(Boolean);
    const purchasePrices = variants.map(p => Number(p.purchasePrice) || 0).filter(Boolean);
    const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const avgPurchase = purchasePrices.length ? purchasePrices.reduce((a, b) => a + b, 0) / purchasePrices.length : 0;
    const avgMargin = avgPrice ? ((avgPrice - avgPurchase) / avgPrice) * 100 : 0;

    return {
        products: variants,
        baseModel,
        name: variants[0].name || baseModel,
        totalStock,
        totalSales,
        totalRevenue,
        avgPrice,
        avgPurchase,
        avgMargin,
        stockByWarehouse,
        chartData: Object.entries(salesByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, ...value })),
        sizes: [...new Set(variants.map(p => p.size).filter(Boolean))].sort(),
        colors: [...new Set(variants.map(p => p.color).filter(Boolean))]
    };
}

function renderChart(chartData) {
    const canvas = document.getElementById('productCardChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: chartData.map(item => item.date.split('-').reverse().slice(0, 2).join('.')),
            datasets: [{
                label: 'Заказы',
                data: chartData.map(item => item.orders),
                borderWidth: 2,
                tension: 0.25,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

export async function renderProductCard() {
    const container = document.getElementById('productCardContent');
    if (!container) return;

    const baseModel = window._selectedBaseModel;
    if (!baseModel) {
        container.innerHTML = '<div class="card" style="text-align:center;padding:60px;"><div style="font-size:18px;font-weight:600;">Товар не выбран</div></div>';
        return;
    }

    container.innerHTML = '<div class="card" style="text-align:center;padding:60px;">⏳ Загрузка данных…</div>';

    try {
        const data = await loadProductData(baseModel);
        if (data.error) throw new Error(data.error);

        const status = getStockStatus(data.totalStock, data.totalSales);
        const stockIndex = data.totalSales > 0 ? data.totalStock / data.totalSales : null;

        container.innerHTML = `
            <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <button class="btn btn-ghost" onclick="window.navigateTo('products')">← Назад к товарам</button>
                <span style="font-size:12px;color:var(--text-secondary);">${escapeHtml(data.baseModel)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:20px;">
                <div>
                    <h1 style="font-size:24px;font-weight:700;margin-bottom:5px;">${escapeHtml(data.name)}</h1>
                    <div style="font-size:13px;color:var(--text-secondary);">Модель: ${escapeHtml(data.baseModel)}</div>
                    <div style="font-size:13px;color:var(--text-secondary);margin-top:5px;">Размеров: ${data.sizes.length} · Цветов: ${data.colors.length} · Вариантов: ${data.products.length}</div>
                </div>
                <span style="padding:5px 14px;border-radius:12px;font-size:13px;font-weight:600;background:${status.color}20;color:${status.color};">${status.text}</span>
            </div>
            <div class="grid-4" style="margin-bottom:20px;">
                <div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-info"><span class="kpi-label">Средняя цена</span><span class="kpi-value">${money(data.avgPrice)}</span></div></div>
                <div class="kpi-card"><div class="kpi-icon">📦</div><div class="kpi-info"><span class="kpi-label">Доступный остаток</span><span class="kpi-value">${qty(data.totalStock)} шт</span></div></div>
                <div class="kpi-card"><div class="kpi-icon">🛒</div><div class="kpi-info"><span class="kpi-label">Заказы за 30 дней</span><span class="kpi-value">${qty(data.totalSales)} шт</span></div></div>
                <div class="kpi-card"><div class="kpi-icon">📊</div><div class="kpi-info"><span class="kpi-label">Индекс остатка</span><span class="kpi-value">${stockIndex === null ? '—' : stockIndex.toFixed(2)}</span></div></div>
            </div>
            <div class="card" style="margin-bottom:20px;">
                <div class="card-title">📈 Заказы за последние 30 дней</div>
                <div style="height:260px;">${data.chartData.length ? '<canvas id="productCardChart"></canvas>' : '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);">Нет данных за последние 30 дней</div>'}</div>
            </div>
            <div class="card">
                <div class="card-title">🏪 Остатки по складам</div>
                <div style="overflow-x:auto;">
                    <table><thead><tr><th>Склад</th><th>Доступно</th><th>Статус</th></tr></thead><tbody>
                    ${Object.entries(data.stockByWarehouse).sort((a, b) => b[1] - a[1]).map(([warehouse, value]) => `<tr><td><strong>${escapeHtml(warehouse)}</strong></td><td>${qty(value)} шт</td><td>${value > 0 ? '🟢 Есть' : '⚫ Нет'}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-secondary);">Нет данных по складам</td></tr>'}
                    </tbody></table>
                </div>
            </div>`;

        if (data.chartData.length) renderChart(data.chartData);
    } catch (error) {
        console.error('[ProductCard]', error);
        container.innerHTML = `<div class="card" style="text-align:center;padding:60px;"><div style="font-size:18px;font-weight:600;color:#EF4444;">Не удалось загрузить карточку</div><div style="margin-top:8px;color:var(--text-secondary);">${escapeHtml(error.message)}</div></div>`;
    }
}

export default renderProductCard;
