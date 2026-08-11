// ============================================================
// PRODUCT LIST — BELTANEE
// Одно изделие = одна карточка.
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';

let currentFilters = { search: '', status: 'all' };
let viewMode = 'grid';
let cache = null;

const norm = value => String(value ?? '').trim().toLowerCase();
const fmt = value => Math.round(Number(value) || 0).toLocaleString('ru-RU');
const money = value => `${fmt(value)} ₽`;

function statusFor(stock, sales30d) {
    if (stock <= 0) return 'no_stock';
    if (sales30d <= 0) return 'no_sales';
    const io = stock / sales30d;
    if (io < 0.2) return 'deficit';
    if (io < 0.5) return 'warning';
    if (io > 2) return 'excess';
    return 'normal';
}

function metricFor(map, key) {
    if (!map || !key) return null;
    return map[norm(key)] || null;
}

async function loadData(force = false) {
    if (!force && cache) return cache;
    const [groups, stock, sales] = await Promise.all([
        ProductService.getProductGroups({ activeOnly: true }),
        StockService.getAllAggregated(),
        SalesService.getAllAggregated(30)
    ]);

    cache = groups.map(group => {
        const groupKey = norm(group.productGroupKey);
        const stockData = metricFor(stock, groupKey);
        const salesData = metricFor(sales, groupKey);
        const variants = group.variants || [];
        const prices = variants.map(p => Number(p.price)).filter(v => v > 0);
        const purchasePrices = variants.map(p => Number(p.purchasePrice)).filter(v => v > 0);
        const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        const avgPurchase = purchasePrices.length ? purchasePrices.reduce((a, b) => a + b, 0) / purchasePrices.length : 0;
        const margin = avgPrice ? ((avgPrice - avgPurchase) / avgPrice) * 100 : null;
        const totalStock = Number(stockData?.available ?? stockData?.total) || 0;
        const totalSales = Number(salesData?.orders) || 0;
        const io = totalSales > 0 ? totalStock / totalSales : null;
        return {
            ...group,
            avgPrice,
            avgPurchase,
            margin,
            totalStock,
            totalSales,
            revenue: Number(salesData?.revenue) || 0,
            io,
            status: statusFor(totalStock, totalSales),
            dataQuality: stockData?.dataQuality || salesData?.dataQuality || 'ok'
        };
    });
    return cache;
}

function filterGroups(groups) {
    const query = norm(currentFilters.search);
    return groups.filter(group => {
        if (query && !(norm(group.name).includes(query) || norm(group.productGroupKey).includes(query) || group.articles.some(a => norm(a).includes(query)) || group.colors.some(c => norm(c).includes(query)))) return false;
        return currentFilters.status === 'all' || group.status === currentFilters.status;
    });
}

function renderGroup(group) {
    const status = { no_stock: ['⚫', 'Нет остатков'], no_sales: ['⚪', 'Нет продаж'], deficit: ['🔴', 'Дефицит'], warning: ['🟡', 'Недостаток'], normal: ['🟢', 'Норма'], excess: ['🔵', 'Избыток'] }[group.status] || ['⚪', 'Нет данных'];
    const prices = (group.variants || []).map(p => Number(p.price)).filter(v => v > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const price = minPrice ? `${money(minPrice)}${minPrice !== maxPrice ? ` — ${money(maxPrice)}` : ''}` : '—';
    const io = group.io === null ? '—' : group.io.toFixed(2);
    const key = encodeURIComponent(group.productGroupKey);
    const title = String(group.name || group.productGroupKey).replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const colors = group.colors || [];
    const sizes = group.sizes || [];
    const colorText = colors.length ? `${colors.length} цв.` : 'Цвет не указан';
    const sizeText = sizes.length ? sizes.join(', ') : 'Размеры не указаны';
    const onclick = `window.openProductCard(decodeURIComponent('${key}'))`;

    if (viewMode === 'list') return `<div class="product-list-item" onclick="${onclick}"><span class="product-list-status">${status[0]}</span><div class="product-list-info"><span class="product-list-name">${title}</span><span class="product-list-sub">${colorText} · ${group.variantCount} вариантов</span><span class="product-list-detail">${sizeText}</span></div><div class="product-list-metrics"><span>${price}</span><span>${fmt(group.totalStock)} шт</span><span>${fmt(group.totalSales)} заказов</span><span>${io}</span></div></div>`;
    return `<div class="product-grid-item" onclick="${onclick}"><div class="product-grid-header"><div><div class="product-grid-name">${title}</div><div class="product-grid-sub">${colorText} · ${group.variantCount} вариантов</div></div><span title="${status[1]}">${status[0]}</span></div><div class="product-grid-sizes">${sizeText}${group.category ? ` · ${group.category}` : ''}</div><div class="product-grid-metrics"><div><span class="metric-label">Цена</span><strong>${price}</strong></div><div><span class="metric-label">Остаток</span><strong>${fmt(group.totalStock)} шт</strong></div><div><span class="metric-label">30 дней</span><strong>${fmt(group.totalSales)}</strong></div><div><span class="metric-label">ИО</span><strong>${io}</strong></div></div></div>`;
}

export async function renderProductList(force = false) {
    const container = document.getElementById('productsGroupedList');
    const empty = document.getElementById('productsEmpty');
    const content = document.getElementById('productsContent');
    const count = document.querySelector('.products-count');
    if (!container) return;
    try {
        const groups = filterGroups(await loadData(force));
        if (empty) empty.style.display = groups.length ? 'none' : 'block';
        if (content) content.style.display = groups.length ? 'block' : 'none';
        if (count) count.textContent = `Товаров: ${groups.length}`;
        const order = { deficit: 0, warning: 1, no_stock: 2, excess: 3, no_sales: 4, normal: 5 };
        groups.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
        container.innerHTML = groups.length ? `<div class="${viewMode === 'grid' ? 'products-grid-wrapper' : 'products-list-wrapper'}">${groups.map(renderGroup).join('')}</div>` : '';
    } catch (error) {
        console.error('[ProductList]', error);
        container.innerHTML = `<div class="card" style="padding:30px;color:#EF4444;">Ошибка загрузки товаров: ${String(error.message || error)}</div>`;
    }
}

export function toggleViewMode(mode) { viewMode = mode === 'list' ? 'list' : 'grid'; renderProductList(); }
window.openProductCard = productGroupKey => { window._selectedProductGroupKey = productGroupKey; window._selectedBaseModel = productGroupKey; window.navigateTo('product-card'); };
window.refreshProductTable = () => { currentFilters.search = document.getElementById('productSearch')?.value || ''; currentFilters.status = document.getElementById('productFilter')?.value || 'all'; cache = null; renderProductList(true); };
window.clearProductFilters = () => { const search = document.getElementById('productSearch'); const filter = document.getElementById('productFilter'); if (search) search.value = ''; if (filter) filter.value = 'all'; currentFilters = { search: '', status: 'all' }; cache = null; renderProductList(true); };
window.setProductView = toggleViewMode;

export default renderProductList;
