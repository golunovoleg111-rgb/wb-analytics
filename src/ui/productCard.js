// ============================================================
// UI: PRODUCT CARD — ДЕТАЛЬНАЯ КАРТОЧКА ТОВАРА
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';

let chartInstance = null;

function formatNumber(value) {
    return Math.round(Number(value) || 0).toLocaleString('ru-RU');
}

function formatPrice(value) {
    return `${formatNumber(value)} ₽`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getStockStatus(stock, sales30d) {
    if (stock <= 0) return { text: 'Нет остатков', color: '#6B7280' };
    if (sales30d <= 0) return { text: 'Нет продаж', color: '#6B7280' };

    // Индекс остатка по Конституции: остаток / продажи за 30 дней.
    const io = stock / sales30d;
    if (io < 0.2) return { text: 'Дефицит', color: '#EF4444' };
    if (io < 0.5) return { text: 'Недостаток', color: '#F59E0B' };
    if (io > 2) return { text: 'Избыток', color: '#3B82F6' };
    return { text: 'Норма', color: '#10B981' };
}

async function loadProductData(baseModel) {
    const products = await ProductService.getByBaseModel(baseModel);
    if (!products.length) {
        return { error: 'Товар не найден', products: [] };
    }

    const stockByWarehouse = {};
    let totalStock = 0;
    let totalRevenue = 0;
    let totalSales = 0;
    const salesByDate = {};

    for (const product of products) {
        const [stock, sales, history] = await Promise.all([
            StockService.getAggregated(product.id),
            SalesService.getAggregated(product.id, 30),
            SalesService.getLastDays(product.id, 30)
        ]);

        totalStock += Number(stock?.available) || 0;
        totalSales += Number(sales?.orders) || 0;
        totalRevenue += Number(sales?.revenue) || 0;

        for (const [warehouse, data] of Object.entries(stock?.byWarehouse || {})) {
            stockByWarehouse[warehouse] = (stockByWarehouse[warehouse] || 0) + (Number(data.available) || 0);
        }

        for (const row of history || []) {
            const date = row.date;
            if (!date) continue;
            if (!salesByDate[date]) salesByDate[date] = { orders: 0, revenue: 0 };
            salesByDate[date].orders += Number(row.orders) || 0;
            salesByDate[date].revenue += Number(row.amount) || 0;
        }
    }

    const prices = products.map(p => Number(p.price) || 0).filter(Boolean);
    const purchasePrices = products.map(p => Number(p.purchasePrice) || 0).filter(Boolean);
    const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const avgPurchase = purchasePrices.length ? purchasePrices.reduce((a, b) => a + b, 0) / purchasePrices.length : 0;
    const avgMargin = avgPrice > 0 ? ((avgPrice - avgPurchase) / avgPrice) * 100 : 0;

    const chartData = Object.entries(salesByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, ...value }));

    return {
        products,
        baseModel,
        name: products[0].name || baseModel,
        totalStock,
        totalSales,
        totalRevenue,
        avgPrice,
        avgPurchase,
        avgMargin,
        stockByWarehouse,
        chartData,
        sizes: [...new Set(products.map(p => p.size).filter(s => s && s !== 'NOSIZE'))].sort(),
        colors: [...new Set(products.map(p => p.color).filter(c => c && c !== 'NOCOLOR'))]
    };
}

function renderChart(chartData) {
    const canvas = document.getElementById('productCardChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    const labels = chartData.map(item => {
        const parts = item.date.split('-');
        return parts.length === 3 ? `${parts[2]}.${parts[1]}` : item.date;
    });
    const orders = chartData.map(item => item.orders);

    chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Заказы',
                data: orders,
                borderWidth: 2,
                tension: 0.25,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}

export async function renderProductCard() {
    const container = document.getElementById('productCardContent');
    if (!container) return;

    const baseModel = window._selectedBaseModel;
    if (!baseModel) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:60px;">
                <div style="font-size:48px;margin-bottom:12px;">🔍</div>
                <div style="font-size:18px;font-weight:600;">Товар не выбран</div>
                <div style="font-size:14px;color:var(--text-secondary);margin-top:6px;">Вернитесь к списку товаров и выберите карточку.</div>
                <button class="btn btn-primary" onclick="window.navigateTo('products')" style="margin-top:16px;">← К товарам</button>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="card" style="text-align:center;padding:60px;">
            <div style="font-size:40px;margin-bottom:12px;">⏳</div>
            <div style="font-size:18px;font-weight:600;">Загрузка карточки…</div>
        </div>`;

    try {
        const data = await loadProductData(baseModel);
        if (data.error) throw new Error(data.error);

        const status = getStockStatus(data.totalStock, data.totalSales);
        const io = data.totalSales > 0 ? data.totalStock / data.totalSales : null;

        container.innerHTML = `
            <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <button class="btn btn-ghost" onclick="window.navigateTo('products')">← Назад к товарам</button>
                <span style="font-size:12px;color:var(--text-secondary);">${escapeHtml(data.baseModel)}</span>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:20px;">
                <div>
                    <h1 style="font-size:24px;font-weight:700;color:var(--text-primary);margin-bottom:5px;">${escapeHtml(data.name)}</h1>
                    <div style="font-size:13px;color:var(--text-secondary);">Модель: ${escapeHtml(data.baseModel)}</div>
                    <div style="font-size:13px;color:var(--text-secondary);margin-top:5px;">
                        Размеров: ${data.sizes.length || 0}${data.colors.length ? ` · Цветов: ${data.colors.length}` : ''} · Вариантов: ${data.products.length}
                    </div>
                </div>
                <span style="display:inline-block;padding:5px 14px;border-radius:12px;font-size:13px;font-weight:600;background:${status.color}20;color:${status.color};border:1px solid ${status.color}40;">
                    ${status.text}
                </span>
            </div>

            <div class="grid-4" style="margin-bottom:20px;">
                <div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-info"><span class="kpi-label">Средняя цена</span><span class="kpi-value">${formatPrice(data.avgPrice)}</span></div></div>
                <div class="kpi-card"><div class="kpi-icon">📦</div><div class="kpi-info"><span class="kpi-label">Доступный остаток</span><span class="kpi-value">${formatNumber(data.totalStock)} шт</span></div></div>
                <div class="kpi-card"><div class="kpi-icon">🛒</div><div class="kpi-info"><span class="kpi-label">Продажи за 30 дней</span><span class="kpi-value">${formatNumber(data.totalSales)} шт</span></div></div>
                <div class="kpi-card"><div class="kpi-icon">📊</div><div class="kpi-info"><span class="kpi-label">Индекс остатка</span><span class="kpi-value">${io === null ? '—' : io.toFixed(2)}</span></div></div>
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div class="card-title">📈 Продажи за последние 30 дней</div>
                <div style="height:260px;">
                    ${data.chartData.length ? '<canvas id="productCardChart"></canvas>' : '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);">Нет данных о продажах за период</div>'}
                </div>
            </div>

            <div class="card">
                <div class="card-title">🏪 Остатки по складам</div>
                <div style="overflow-x:auto;">
                    <table>
                        <thead><tr><th>Склад</th><th>Доступно</th><th>Статус</th></tr></thead>
                        <tbody>
                            ${Object.entries(data.stockByWarehouse).length
                                ? Object.entries(data.stockByWarehouse).sort((a, b) => b[1] - a[1]).map(([warehouse, quantity]) => `
                                    <tr><td><strong>${escapeHtml(warehouse)}</strong></td><td>${formatNumber(quantity)} шт</td><td>${quantity > 0 ? '🟢 Есть' : '⚫ Нет'}</td></tr>`).join('')
                                : '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-secondary);">Нет данных по складам</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        if (data.chartData.length) renderChart(data.chartData);
    } catch (error) {
        console.error('[ProductCard] Ошибка загрузки:', error);
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:60px;">
                <div style="font-size:48px;margin-bottom:12px;">❌</div>
                <div style="font-size:18px;font-weight:600;color:#EF4444;">Не удалось загрузить карточку</div>
                <div style="font-size:14px;color:var(--text-secondary);margin-top:8px;">${escapeHtml(error.message || 'Неизвестная ошибка')}</div>
                <button class="btn btn-primary" onclick="window.navigateTo('products')" style="margin-top:16px;">← К товарам</button>
            </div>`;
    }
}

export default renderProductCard;
