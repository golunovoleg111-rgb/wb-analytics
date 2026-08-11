// ============================================================
// DASHBOARD — BELTANEE v6.1
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';

function dateString(date) { return date.toISOString().slice(0, 10); }
function getYesterday() { const date = new Date(); date.setDate(date.getDate() - 1); return dateString(date); }
function getLastDays(days) { const result = []; for (let offset = days - 1; offset >= 0; offset--) { const date = new Date(); date.setDate(date.getDate() - offset); result.push(dateString(date)); } return result; }

function metricFor(map, product) {
    if (!map || !product) return null;
    const keys = [product.articleKey, product.id, product.article, product.baseModel].map(v => String(v || '').toLowerCase());
    for (const key of keys) if (map[key]) return map[key];
    const article = String(product.article || '').toLowerCase();
    const base = String(product.baseModel || '').toLowerCase();
    for (const [key, value] of Object.entries(map)) {
        const normalized = String(key).toLowerCase();
        if (normalized === base || normalized === article || normalized.startsWith(`${article}|`)) return value;
    }
    return null;
}

async function getDashboardData() {
    const [products, sales, stock, sales30] = await Promise.all([ProductService.getActive(), SalesService.getAll(), StockService.getAllAggregated(), SalesService.getAllAggregated(30)]);
    const yesterday = getYesterday();
    const yesterdayRows = sales.filter(row => row.date === yesterday);
    const yesterdayOrders = yesterdayRows.reduce((sum, row) => sum + (Number(row.orders) || 0), 0);
    const yesterdayDelivered = yesterdayRows.reduce((sum, row) => sum + (Number(row.delivered) || 0), 0);
    const yesterdayRevenue = yesterdayRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

    const margins = products.map(product => {
        const price = Number(product.price) || 0;
        const purchase = Number(product.purchasePrice) || 0;
        return price > 0 && purchase >= 0 ? ((price - purchase) / price) * 100 : null;
    }).filter(value => value !== null && Number.isFinite(value));

    const criticalProducts = [];
    for (const product of products) {
        const stockData = metricFor(stock, product);
        const salesData = metricFor(sales30, product);
        const available = Number(stockData?.available) || 0;
        const orders30 = Number(salesData?.orders) || 0;
        if (orders30 <= 0 || available <= 0) continue;
        const io = available / orders30;
        if (io < 0.2) criticalProducts.push({ product, stock: available, orders30, io });
    }

    const last7Days = getLastDays(7).map(fullDate => {
        const rows = sales.filter(row => row.date === fullDate);
        return { dateFull: fullDate, date: `${fullDate.slice(8, 10)}.${fullDate.slice(5, 7)}`, revenue: rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), orders: rows.reduce((sum, row) => sum + (Number(row.orders) || 0), 0) };
    });

    return { totalProducts: products.length, yesterdayOrders, yesterdayDelivered, yesterdayRevenue, avgMargin: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0, criticalProducts: criticalProducts.sort((a, b) => a.io - b.io).slice(0, 10), last7Days };
}

export async function renderDashboard() {
    const emptyContainer = document.getElementById('dashboardEmpty');
    const contentContainer = document.getElementById('dashboardContent');
    try {
        const data = await getDashboardData();
        if (data.totalProducts === 0) { if (emptyContainer) emptyContainer.style.display = 'block'; if (contentContainer) contentContainer.style.display = 'none'; return; }
        if (emptyContainer) emptyContainer.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block';
        renderKPIs(data); renderAttentionBlock(data.criticalProducts); renderMiniChart(data.last7Days);
    } catch (error) {
        console.error('[Dashboard]', error);
        if (emptyContainer) { emptyContainer.style.display = 'block'; emptyContainer.innerHTML = `<div style="font-size:48px;margin-bottom:12px;">❌</div><div style="font-size:18px;font-weight:600;margin-bottom:6px;">Ошибка загрузки</div><div style="font-size:14px;color:var(--text-secondary);">${error.message}</div>`; }
    }
}

function renderKPIs(data) {
    const products = document.getElementById('kpiProducts');
    const orders = document.getElementById('kpiOrders');
    const delivered = document.getElementById('kpiDelivered');
    const margin = document.getElementById('kpiAvgMargin');
    if (products) products.textContent = data.totalProducts.toLocaleString('ru-RU');
    if (orders) orders.textContent = data.yesterdayOrders.toLocaleString('ru-RU');
    if (delivered) delivered.textContent = data.yesterdayDelivered.toLocaleString('ru-RU');
    if (margin) margin.textContent = `${data.avgMargin.toFixed(1)}%`;
}

function renderAttentionBlock(items) {
    const container = document.getElementById('attentionBlock');
    if (!container) return;
    if (!items.length) { container.innerHTML = '<div style="color:#10B981;font-size:13px;padding:4px 0;">✅ Критического дефицита не обнаружено</div>'; return; }
    container.innerHTML = items.map(item => `<div style="padding:8px 12px;background:#FEF2F2;border-left:3px solid #EF4444;margin-bottom:6px;border-radius:6px;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:12px;"><span>🔴 <strong>${item.product.article}</strong> — остаток ${Math.round(item.stock)} шт, ИО ${item.io.toFixed(2)}</span><button class="btn btn-xs btn-danger" onclick="window.openProductCard('${String(item.product.baseModel || item.product.article).replaceAll("'", "\\'")}')">Открыть</button></div>`).join('');
}

function renderMiniChart(last7Days) {
    const canvas = document.getElementById('dashboardChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (window.dashboardChart) window.dashboardChart.destroy();
    window.dashboardChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: last7Days.map(item => item.date), datasets: [
            { label: 'Выручка', data: last7Days.map(item => item.revenue), borderWidth: 2, fill: false, tension: 0.3 },
            { label: 'Заказы', data: last7Days.map(item => item.orders), borderWidth: 2, borderDash: [4, 3], fill: false, tension: 0.3, yAxisID: 'orders' }
        ] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }, orders: { position: 'right', beginAtZero: true, grid: { display: false } } } }
    });
}

export default renderDashboard;
