// ============================================================
// PRODUCT LIST — BELTANEE v6.1
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

function findMetric(map, product) {
    if (!map || !product) return null;
    const keys = [product.articleKey, product.id, product.article].map(norm).filter(Boolean);
    for (const key of keys) if (map[key]) return map[key];
    const article = norm(product.article);
    for (const [key, value] of Object.entries(map)) {
        const normalized = norm(key);
        if (normalized === article || normalized.startsWith(`${article}|`)) return value;
    }
    return null;
}

async function loadData(force = false) {
    if (!force && cache) return cache;
    const [products, stock, sales] = await Promise.all([
        ProductService.getActive(),
        StockService.getAllAggregated(),
        SalesService.getAllAggregated(30)
    ]);

    const groups = {};
    for (const product of products) {
        const base = product.baseModel || product.article || 'Без артикула';
        if (!groups[base]) groups[base] = { baseModel: base, name: product.name || base, products: [], sizes: new Set(), colors: new Set(), totalStock: 0, totalSales: 0, revenue: 0, prices: [], purchasePrices: [] };
        const group = groups[base];
        group.products.push(product);
        if (product.size && product.size !== 'NOSIZE') group.sizes.add(product.size);
        if (product.color && product.color !== 'NOCOLOR') group.colors.add(product.color);
        const stockData = findMetric(stock, product);
        group.totalStock += Number(stockData?.available) || 0;
        const salesData = findMetric(sales, product);
        group.totalSales += Number(salesData?.orders) || 0;
        group.revenue += Number(salesData?.revenue) || 0;
        if (Number(product.price) > 0) group.prices.push(Number(product.price));
        if (Number(product.purchasePrice) > 0) group.purchasePrices.push(Number(product.purchasePrice));
    }

    cache = Object.values(groups).map(group => {
        const avgPrice = group.prices.length ? group.prices.reduce((a, b) => a + b, 0) / group.prices.length : 0;
        const avgPurchase = group.purchasePrices.length ? group.purchasePrices.reduce((a, b) => a + b, 0) / group.purchasePrices.length : 0;
        const margin = avgPrice ? ((avgPrice - avgPurchase) / avgPrice) * 100 : 0;
        const io = group.totalSales > 0 ? group.totalStock / group.totalSales : null;
        return { ...group, sizes: [...group.sizes].sort(), colors: [...group.colors].sort(), avgPrice, avgPurchase, margin, io, status: statusFor(group.totalStock, group.totalSales) };
    });
    return cache;
}

function filterGroups(groups) {
    const query = norm(currentFilters.search);
    return groups.filter(group => {
        if (query && !(norm(group.baseModel).includes(query) || norm(group.name).includes(query) || group.products.some(product => norm(product.article).includes(query)))) return false;
        return currentFilters.status === 'all' || group.status === currentFilters.status;
    });
}

function renderGroup(group) {
    const status = { no_stock: ['⚫', 'Нет остатков'], no_sales: ['⚪', 'Нет продаж'], deficit: ['🔴', 'Дефицит'], warning: ['🟡', 'Недостаток'], normal: ['🟢', 'Норма'], excess: ['🔵', 'Избыток'] }[group.status] || ['⚪', 'Нет данных'];
    const minPrice = group.prices.length ? Math.min(...group.prices) : 0;
    const maxPrice = group.prices.length ? Math.max(...group.prices) : 0;
    const price = minPrice ? `${money(minPrice)}${minPrice !== maxPrice ? ` — ${money(maxPrice)}` : ''}` : '—';
    const io = group.io === null ? '—' : group.io.toFixed(2);
    const base = String(group.baseModel).replaceAll("'", "\\'");

    if (viewMode === 'list') return `<div class="product-list-item" onclick="window.openProductCard('${base}')"><span class="product-list-status">${status[0]}</span><div class="product-list-info"><span class="product-list-name">${group.baseModel}</span><span class="product-list-sub">${group.name}</span><span class="product-list-detail">${group.sizes.join(', ') || 'Размеры не указаны'}</span></div><div class="product-list-metrics"><span>${price}</span><span>${fmt(group.totalStock)} шт</span><span>${fmt(group.totalSales)} заказов</span><span>${io}</span></div></div>`;

    return `<div class="product-grid-item" onclick="window.openProductCard('${base}')"><div class="product-grid-header"><div><div class="product-grid-name">${group.baseModel}</div><div class="product-grid-sub">${group.name}</div></div><span title="${status[1]}">${status[0]}</span></div><div class="product-grid-sizes">${group.sizes.slice(0, 8).join(', ') || 'Размеры не указаны'}${group.colors.length ? ` · ${group.colors.length} цв.` : ''}</div><div class="product-grid-metrics"><div><span class="metric-label">Цена</span><strong>${price}</strong></div><div><span class="metric-label">Остаток</span><strong>${fmt(group.totalStock)} шт</strong></div><div><span class="metric-label">30 дней</span><strong>${fmt(group.totalSales)}</strong></div><div><span class="metric-label">ИО</span><strong>${io}</strong></div></div></div>`;
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
        document.querySelectorAll('.view-toggle-btn').forEach(button => button.classList.toggle('active', button.dataset.view === viewMode));
    } catch (error) {
        console.error('[ProductList]', error);
        container.innerHTML = `<div class="card" style="padding:30px;color:#EF4444;">Ошибка загрузки товаров: ${error.message}</div>`;
    }
}

export function toggleViewMode(mode) {
    viewMode = mode === 'list' ? 'list' : 'grid';
    renderProductList();
}

window.openProductCard = baseModel => { window._selectedBaseModel = baseModel; window.navigateTo('product-card'); };
window.refreshProductTable = () => { currentFilters.search = document.getElementById('productSearch')?.value || ''; currentFilters.status = document.getElementById('productFilter')?.value || 'all'; cache = null; renderProductList(true); };
window.clearProductFilters = () => { const search = document.getElementById('productSearch'); const filter = document.getElementById('productFilter'); if (search) search.value = ''; if (filter) filter.value = 'all'; currentFilters = { search: '', status: 'all' }; cache = null; renderProductList(true); };
window.setProductView = toggleViewMode;

export default renderProductList;
