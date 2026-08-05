// ============================================================
// UI: PRODUCT LIST — СТРАНИЦА "ТОВАРЫ"
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let currentFilters = { search: '', status: 'all' };
let viewMode = 'grid'; // grid | list
let allProducts = [];
let allStock = {};
let allSales = {};
let cachedGroups = null;

// ============================================================
// ЗАГРУЗКА ДАННЫХ (С КЕШИРОВАНИЕМ)
// ============================================================

async function loadData(force = false) {
    if (!force && cachedGroups) return cachedGroups;
    
    console.log('📦 Загрузка данных для товаров...');
    
    const [products, stockAggregated, salesAggregated] = await Promise.all([
        ProductService.getActive(),
        StockService.getAllAggregated(),
        SalesService.getAllAggregated(30)
    ]);
    
    allProducts = products;
    allStock = stockAggregated;
    allSales = salesAggregated;
    
    console.log(`📦 Товаров: ${allProducts.length}`);
    console.log(`📦 Записей остатков: ${Object.keys(allStock).length}`);
    console.log(`📦 Записей продаж: ${Object.keys(allSales).length}`);
    
    // Группируем и кешируем
    cachedGroups = buildGroups(allProducts);
    return cachedGroups;
}

// ============================================================
// ПОИСК ДАННЫХ ПО ТОВАРУ
// ============================================================

function findDataByProduct(product, dataMap) {
    if (!product || !dataMap) return null;
    
    const keys = [
        product.articleKey,
        product.id,
        `${product.article}|${product.size || 'NOSIZE'}|${product.color || 'NOCOLOR'}`.toLowerCase(),
        `${product.article}|${product.size || 'NOSIZE'}`.toLowerCase(),
        product.article?.toLowerCase(),
        product.article
    ];
    
    for (const key of keys) {
        if (key && dataMap[key]) return dataMap[key];
    }
    
    const lowerArticle = product.article?.toLowerCase() || '';
    for (const [key, value] of Object.entries(dataMap)) {
        if (key && key.toLowerCase().includes(lowerArticle)) return value;
        if (key && key.toLowerCase().startsWith(lowerArticle + '|')) return value;
    }
    
    return null;
}

function getStockForProduct(product) {
    const result = findDataByProduct(product, allStock);
    return result || { available: 0, total: 0, byWarehouse: {} };
}

function getSalesForProduct(product) {
    const result = findDataByProduct(product, allSales);
    return result || { orders: 0, revenue: 0 };
}

// ============================================================
// ГРУППИРОВКА
// ============================================================

function buildGroups(products) {
    const groups = {};
    
    products.forEach(product => {
        const base = product.baseModel || product.article || 'unknown';
        
        if (!groups[base]) {
            groups[base] = {
                baseModel: base,
                name: product.name || base,
                products: [],
                sizes: new Set(),
                colors: new Set(),
                totalStock: 0,
                totalSales: 0,
                minPrice: Infinity,
                maxPrice: 0,
                minPurchase: Infinity,
                maxMargin: 0,
                minMargin: Infinity,
                status: 'normal',
                io: 0
            };
        }
        
        const group = groups[base];
        group.products.push(product);
        
        if (product.size && product.size !== 'NOSIZE') group.sizes.add(product.size);
        if (product.color && product.color !== 'NOCOLOR') group.colors.add(product.color);
        
        const stock = getStockForProduct(product);
        const available = stock.available || 0;
        group.totalStock += available;
        
        const sales = getSalesForProduct(product);
        group.totalSales += sales.orders || 0;
        
        const price = product.price || 0;
        if (price > 0) {
            group.minPrice = Math.min(group.minPrice, price);
            group.maxPrice = Math.max(group.maxPrice, price);
        }
        
        const purchase = product.purchasePrice || 0;
        if (purchase > 0) group.minPurchase = Math.min(group.minPurchase, purchase);
        
        const margin = product.margin || 0;
        if (margin > 0) {
            group.minMargin = Math.min(group.minMargin, margin);
            group.maxMargin = Math.max(group.maxMargin, margin);
        }
    });
    
    Object.values(groups).forEach(group => {
        const dailySales = group.totalSales / 30;
        const io = dailySales > 0 ? group.totalStock / dailySales : (group.totalStock > 0 ? 999 : 0);
        group.io = io;
        
        if (group.totalStock === 0) group.status = 'no_stock';
        else if (io < 1) group.status = 'deficit';
        else if (io < 3) group.status = 'warning';
        else group.status = 'normal';
    });
    
    console.log(`📦 Сгруппировано: ${Object.values(groups).length} групп`);
    return Object.values(groups);
}

// ============================================================
// ФИЛЬТРАЦИЯ
// ============================================================

function filterGroups(groups) {
    const { search, status } = currentFilters;
    
    return groups.filter(group => {
        if (search) {
            const q = search.toLowerCase();
            const match = group.baseModel.toLowerCase().includes(q) ||
                         group.name.toLowerCase().includes(q) ||
                         group.products.some(p => p.article?.toLowerCase().includes(q));
            if (!match) return false;
        }
        if (status !== 'all' && group.status !== status) return false;
        return true;
    });
}

// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

function fmtPrice(v) {
    if (!v || v === Infinity || v === -Infinity) return '0 ₽';
    return Math.round(v).toLocaleString() + ' ₽';
}

function fmtMargin(v) {
    if (!v || v === Infinity || v === -Infinity) return '0%';
    return Math.round(v) + '%';
}

function fmtIO(v) {
    if (v === Infinity || v === -Infinity || v === 0) return '0';
    return v.toFixed(1);
}

// ============================================================
// РЕНДЕРИНГ КАРТОЧКИ (СЕТКА)
// ============================================================

function renderGridCard(group) {
    const statusMap = {
        no_stock: { icon: '⚫', color: '#6B7280' },
        deficit: { icon: '🔴', color: '#EF4444' },
        warning: { icon: '🟡', color: '#F59E0B' },
        normal: { icon: '🟢', color: '#10B981' }
    };
    const st = statusMap[group.status] || statusMap.normal;
    
    const sizes = Array.from(group.sizes).sort();
    const colorsCount = group.colors.size;
    const sizesDisplay = sizes.length > 0 ? sizes.slice(0, 5).join(', ') + (sizes.length > 5 ? ` +${sizes.length - 5}` : '') : 'Нет размеров';
    
    let priceDisplay = '0 ₽';
    if (group.minPrice > 0 && group.minPrice !== Infinity) {
        priceDisplay = group.minPrice === group.maxPrice ? fmtPrice(group.minPrice) : `${fmtPrice(group.minPrice)} — ${fmtPrice(group.maxPrice)}`;
    }
    
    let marginDisplay = '0%';
    if (group.maxMargin > 0) marginDisplay = fmtMargin(group.maxMargin);
    else if (group.minMargin > 0 && group.minMargin !== Infinity) marginDisplay = fmtMargin(group.minMargin);
    
    return `
        <div class="product-grid-item" data-base="${group.baseModel}" onclick="window.openProductCard('${group.baseModel}')">
            <div class="product-grid-header">
                <div>
                    <div class="product-grid-name">${group.baseModel}</div>
                    <div class="product-grid-sub">${group.name}</div>
                </div>
                <span class="product-grid-status">${st.icon}</span>
            </div>
            <div class="product-grid-sizes">${sizesDisplay} ${colorsCount > 0 ? `· ${colorsCount} цв.` : ''}</div>
            <div class="product-grid-metrics">
                <div><span class="metric-label">Цена</span> <strong>${priceDisplay}</strong></div>
                <div><span class="metric-label">Остаток</span> <strong>${group.totalStock} шт</strong></div>
                <div><span class="metric-label">Маржа</span> <strong style="color:${group.maxMargin > 20 ? '#10B981' : '#F59E0B'};">${marginDisplay}</strong></div>
                <div><span class="metric-label">ИО</span> <strong>${fmtIO(group.io)}</strong></div>
            </div>
        </div>
    `;
}

// ============================================================
// РЕНДЕРИНГ КАРТОЧКИ (СПИСОК)
// ============================================================

function renderListCard(group) {
    const statusMap = {
        no_stock: { icon: '⚫' },
        deficit: { icon: '🔴' },
        warning: { icon: '🟡' },
        normal: { icon: '🟢' }
    };
    const st = statusMap[group.status] || statusMap.normal;
    
    const sizes = Array.from(group.sizes).sort();
    const colorsCount = group.colors.size;
    const sizesDisplay = sizes.length > 0 ? sizes.join(', ') : 'Нет размеров';
    
    let priceDisplay = '0 ₽';
    if (group.minPrice > 0 && group.minPrice !== Infinity) {
        priceDisplay = group.minPrice === group.maxPrice ? fmtPrice(group.minPrice) : `${fmtPrice(group.minPrice)} — ${fmtPrice(group.maxPrice)}`;
    }
    
    let marginDisplay = '0%';
    if (group.maxMargin > 0) marginDisplay = fmtMargin(group.maxMargin);
    else if (group.minMargin > 0 && group.minMargin !== Infinity) marginDisplay = fmtMargin(group.minMargin);
    
    return `
        <div class="product-list-item" onclick="window.openProductCard('${group.baseModel}')">
            <span class="product-list-status">${st.icon}</span>
            <div class="product-list-info">
                <span class="product-list-name">${group.baseModel}</span>
                <span class="product-list-sub">${group.name}</span>
                <span class="product-list-detail">${sizesDisplay} ${colorsCount > 0 ? `· ${colorsCount} цв.` : ''}</span>
            </div>
            <div class="product-list-metrics">
                <span>${priceDisplay}</span>
                <span>${group.totalStock} шт</span>
                <span style="color:${group.maxMargin > 20 ? '#10B981' : '#F59E0B'};">${marginDisplay}</span>
                <span>${fmtIO(group.io)}</span>
            </div>
        </div>
    `;
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function renderProductList() {
    console.log('📦 Рендеринг списка товаров...');
    
    const container = document.getElementById('productsGroupedList');
    const emptyContainer = document.getElementById('productsEmpty');
    const contentContainer = document.getElementById('productsContent');
    const countEl = document.querySelector('.products-count');
    
    if (!container) {
        console.warn('⚠️ Контейнер productsGroupedList не найден');
        return;
    }
    
    try {
        const groups = await loadData();
        
        if (!groups || groups.length === 0) {
            if (emptyContainer) emptyContainer.style.display = 'block';
            if (contentContainer) contentContainer.style.display = 'none';
            if (countEl) countEl.textContent = 'Товаров: 0';
            return;
        }
        
        if (emptyContainer) emptyContainer.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block';
        
        let filtered = filterGroups(groups);
        
        const statusOrder = { deficit: 0, warning: 1, normal: 2, no_stock: 3 };
        filtered.sort((a, b) => (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0));
        
        if (countEl) countEl.textContent = `Товаров: ${filtered.length}`;
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align:center;padding:30px;">
                    <div style="font-size:36px;margin-bottom:8px;">🔍</div>
                    <div style="font-size:14px;font-weight:500;">Ничего не найдено</div>
                    <div style="font-size:12px;color:var(--text-secondary);">Попробуйте изменить параметры поиска</div>
                </div>
            `;
            return;
        }
        
        const renderFn = viewMode === 'grid' ? renderGridCard : renderListCard;
        const wrapperClass = viewMode === 'grid' ? 'products-grid-wrapper' : 'products-list-wrapper';
        
        container.innerHTML = `<div class="${wrapperClass}">${filtered.map(renderFn).join('')}</div>`;
        
        // Навешиваем обработчики на переключатели вида
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewMode);
        });
        
        console.log(`✅ Отображено ${filtered.length} групп (${viewMode})`);
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:30px;color:#EF4444;">
                <div style="font-size:48px;margin-bottom:12px;">❌</div>
                <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Ошибка загрузки</div>
                <div style="font-size:13px;color:var(--text-secondary);">${error.message}</div>
            </div>
        `;
    }
}

// ============================================================
// ГЛОБАЛЬНЫЕ ФУНКЦИИ
// ============================================================

window.openProductCard = function(baseModel) {
    if (!baseModel) return;
    window._selectedBaseModel = baseModel;
    window.navigateTo('product-card');
};

window.refreshProductTable = function() {
    const searchInput = document.getElementById('productSearch');
    const statusSelect = document.getElementById('productFilter');
    if (searchInput) currentFilters.search = searchInput.value;
    if (statusSelect) currentFilters.status = statusSelect.value;
    renderProductList();
};

window.clearProductFilters = function() {
    const searchInput = document.getElementById('productSearch');
    const statusSelect = document.getElementById('productFilter');
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = 'all';
    currentFilters = { search: '', status: 'all' };
    renderProductList();
};

window.toggleViewMode = function(mode) {
    viewMode = mode;
    document.querySelectorAll('.view-toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.view === mode);
    });
    renderProductList();
};

// ============================================================
// ЭКСПОРТ
// ============================================================

export default renderProductList;
