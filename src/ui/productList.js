// ============================================================
// UI: PRODUCT LIST — СТРАНИЦА "ТОВАРЫ"
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let currentFilters = {
    search: '',
    status: 'all'
};

let viewMode = 'grid'; // grid | list
let allProducts = [];
let allStock = {};
let allSales = {};

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadData() {
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
}

// ============================================================
// ПОИСК ДАННЫХ ПО ТОВАРУ (УНИВЕРСАЛЬНЫЙ)
// ============================================================

function findDataByProduct(product, dataMap) {
    if (!product || !dataMap) return null;
    
    // 1. По articleKey
    if (product.articleKey && dataMap[product.articleKey]) {
        return dataMap[product.articleKey];
    }
    
    // 2. По id
    if (product.id && dataMap[product.id]) {
        return dataMap[product.id];
    }
    
    // 3. По артикулу с вариациями
    const article = product.article || '';
    const size = product.size || '';
    const color = product.color || '';
    
    const variants = [
        `${article}|${size}|${color}`.toLowerCase(),
        `${article}|${size}`.toLowerCase(),
        article.toLowerCase(),
        article
    ];
    
    for (const key of variants) {
        if (dataMap[key]) {
            return dataMap[key];
        }
    }
    
    // 4. Частичное совпадение по артикулу
    const lowerArticle = article.toLowerCase();
    for (const [key, value] of Object.entries(dataMap)) {
        if (key && key.toLowerCase().includes(lowerArticle)) {
            return value;
        }
        if (key && key.toLowerCase().startsWith(lowerArticle + '|')) {
            return value;
        }
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
// ГРУППИРОВКА ПО БАЗЕ АРТИКУЛА
// ============================================================

function groupByBase(products) {
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
        
        if (product.size && product.size !== 'NOSIZE') {
            group.sizes.add(product.size);
        }
        if (product.color && product.color !== 'NOCOLOR') {
            group.colors.add(product.color);
        }
        
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
        if (purchase > 0) {
            group.minPurchase = Math.min(group.minPurchase, purchase);
        }
        
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
        
        if (group.totalStock === 0) {
            group.status = 'no_stock';
        } else if (io < 1) {
            group.status = 'deficit';
        } else if (io < 3) {
            group.status = 'warning';
        } else {
            group.status = 'normal';
        }
    });
    
    return Object.values(groups);
}

// ============================================================
// ФИЛЬТРАЦИЯ
// ============================================================

function filterGroups(groups) {
    const { search, status } = currentFilters;
    
    return groups.filter(group => {
        if (search) {
            const query = search.toLowerCase();
            const match = 
                group.baseModel.toLowerCase().includes(query) ||
                group.name.toLowerCase().includes(query) ||
                group.products.some(p => p.article.toLowerCase().includes(query));
            if (!match) return false;
        }
        
        if (status !== 'all' && group.status !== status) {
            return false;
        }
        
        return true;
    });
}

// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

function formatPrice(value) {
    if (!value || value === Infinity || value === -Infinity) return '0 ₽';
    return Math.round(value).toLocaleString() + ' ₽';
}

function formatMargin(value) {
    if (!value || value === Infinity || value === -Infinity) return '0%';
    return Math.round(value) + '%';
}

function formatIO(value) {
    if (value === Infinity || value === -Infinity || value === 0) return '0';
    return value.toFixed(1);
}

// ============================================================
// ОТРИСОВКА КАРТОЧКИ (СЕТКА)
// ============================================================

function renderGridCard(group) {
    const statusLabels = {
        'no_stock': { label: 'Нет остатков', color: '#6B7280', icon: '⚫' },
        'deficit': { label: 'Дефицит', color: '#EF4444', icon: '🔴' },
        'warning': { label: 'Внимание', color: '#F59E0B', icon: '🟡' },
        'normal': { label: 'В наличии', color: '#10B981', icon: '🟢' }
    };
    
    const statusInfo = statusLabels[group.status] || statusLabels['normal'];
    const sizes = Array.from(group.sizes).sort();
    const colorsCount = group.colors.size;
    
    let priceDisplay = '0 ₽';
    if (group.minPrice > 0 && group.minPrice !== Infinity) {
        if (group.minPrice === group.maxPrice) {
            priceDisplay = formatPrice(group.minPrice);
        } else {
            priceDisplay = `${formatPrice(group.minPrice)} — ${formatPrice(group.maxPrice)}`;
        }
    }
    
    let marginDisplay = '0%';
    if (group.minMargin !== Infinity && group.minMargin > 0) {
        if (group.minMargin === group.maxMargin) {
            marginDisplay = formatMargin(group.minMargin);
        } else {
            marginDisplay = `${formatMargin(group.minMargin)} — ${formatMargin(group.maxMargin)}`;
        }
    } else if (group.maxMargin > 0) {
        marginDisplay = formatMargin(group.maxMargin);
    }
    
    const ioDisplay = formatIO(group.io);
    const sizesDisplay = sizes.length > 0 ? sizes.slice(0, 5).join(', ') + (sizes.length > 5 ? ` +${sizes.length - 5}` : '') : 'Нет размеров';

    return `
        <div class="product-card-grid" data-base="${group.baseModel}" style="cursor:pointer;" onclick="window.openProductCard('${group.baseModel}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <div>
                    <div style="font-weight:600;font-size:14px;color:#1A1A2E;">${group.baseModel}</div>
                    <div style="font-size:12px;color:#6B7280;">${group.name}</div>
                </div>
                <span style="font-size:14px;">${statusInfo.icon}</span>
            </div>
            
            <div style="font-size:11px;color:#9CA3AF;margin-bottom:10px;">
                ${sizesDisplay}
                ${colorsCount > 0 ? ` · ${colorsCount} цветов` : ''}
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px;background:#FAF8FF;padding:10px 12px;border-radius:6px;">
                <div><span style="color:#6B7280;">Цена:</span> <strong>${priceDisplay}</strong></div>
                <div><span style="color:#6B7280;">Остаток:</span> <strong>${group.totalStock} шт</strong></div>
                <div><span style="color:#6B7280;">Маржа:</span> <strong style="color:${group.maxMargin > 20 ? '#10B981' : '#F59E0B'};">${marginDisplay}</strong></div>
                <div><span style="color:#6B7280;">ИО:</span> <strong>${ioDisplay}</strong></div>
            </div>
        </div>
    `;
}

// ============================================================
// ОТРИСОВКА КАРТОЧКИ (СПИСОК)
// ============================================================

function renderListCard(group) {
    const statusLabels = {
        'no_stock': { label: 'Нет остатков', color: '#6B7280', icon: '⚫' },
        'deficit': { label: 'Дефицит', color: '#EF4444', icon: '🔴' },
        'warning': { label: 'Внимание', color: '#F59E0B', icon: '🟡' },
        'normal': { label: 'В наличии', color: '#10B981', icon: '🟢' }
    };
    
    const statusInfo = statusLabels[group.status] || statusLabels['normal'];
    const sizes = Array.from(group.sizes).sort();
    const colorsCount = group.colors.size;
    
    let priceDisplay = '0 ₽';
    if (group.minPrice > 0 && group.minPrice !== Infinity) {
        if (group.minPrice === group.maxPrice) {
            priceDisplay = formatPrice(group.minPrice);
        } else {
            priceDisplay = `${formatPrice(group.minPrice)} — ${formatPrice(group.maxPrice)}`;
        }
    }
    
    let marginDisplay = '0%';
    if (group.minMargin !== Infinity && group.minMargin > 0) {
        if (group.minMargin === group.maxMargin) {
            marginDisplay = formatMargin(group.minMargin);
        } else {
            marginDisplay = `${formatMargin(group.minMargin)} — ${formatMargin(group.maxMargin)}`;
        }
    } else if (group.maxMargin > 0) {
        marginDisplay = formatMargin(group.maxMargin);
    }
    
    const ioDisplay = formatIO(group.io);
    const sizesDisplay = sizes.length > 0 ? sizes.join(', ') : 'Нет размеров';

    return `
        <div class="product-card-list" data-base="${group.baseModel}" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #F0ECF8;" onclick="window.openProductCard('${group.baseModel}')">
            <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
                <span style="font-size:16px;">${statusInfo.icon}</span>
                <div style="min-width:0;">
                    <div style="font-weight:600;font-size:13px;color:#1A1A2E;">${group.baseModel}</div>
                    <div style="font-size:11px;color:#6B7280;">${group.name}</div>
                </div>
                <div style="font-size:11px;color:#9CA3AF;white-space:nowrap;">
                    ${sizesDisplay}
                    ${colorsCount > 0 ? ` · ${colorsCount} цв.` : ''}
                </div>
            </div>
            <div style="display:flex;gap:16px;font-size:12px;flex-shrink:0;">
                <div><span style="color:#6B7280;">Цена:</span> ${priceDisplay}</div>
                <div><span style="color:#6B7280;">Остаток:</span> ${group.totalStock} шт</div>
                <div><span style="color:#6B7280;">Маржа:</span> <span style="color:${group.maxMargin > 20 ? '#10B981' : '#F59E0B'};">${marginDisplay}</span></div>
                <div><span style="color:#6B7280;">ИО:</span> ${ioDisplay}</div>
            </div>
        </div>
    `;
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ РЕНДЕРИНГА
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
        await loadData();
        
        if (allProducts.length === 0) {
            if (emptyContainer) emptyContainer.style.display = 'block';
            if (contentContainer) contentContainer.style.display = 'none';
            if (countEl) countEl.textContent = 'Товаров: 0';
            return;
        }
        
        if (emptyContainer) emptyContainer.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block';
        
        let groups = groupByBase(allProducts);
        groups = filterGroups(groups);
        
        const statusOrder = { deficit: 0, warning: 1, normal: 2, no_stock: 3 };
        groups.sort((a, b) => (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0));
        
        if (countEl) {
            countEl.textContent = `Товаров: ${groups.length}`;
        }
        
        if (groups.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align:center;padding:30px;">
                    <div style="font-size:36px;margin-bottom:8px;">🔍</div>
                    <div style="font-size:14px;font-weight:500;">Ничего не найдено</div>
                    <div style="font-size:12px;color:var(--text-secondary);">Попробуйте изменить параметры поиска</div>
                </div>
            `;
            return;
        }
        
        // Рендерим в зависимости от режима
        const renderFn = viewMode === 'grid' ? renderGridCard : renderListCard;
        const containerClass = viewMode === 'grid' ? 'products-grid' : 'products-list';
        
        container.innerHTML = `
            <div class="${containerClass}">
                ${groups.map(group => renderFn(group)).join('')}
            </div>
        `;
        
        console.log(`✅ Отображено ${groups.length} групп товаров (${viewMode} режим)`);
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
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
    console.log('📋 Открываем карточку товара:', baseModel);
    // Переход на страницу карточки
    window.navigateTo('product-card');
    // TODO: передать baseModel в карточку
    showToast(`📋 Карточка: ${baseModel}`, 'success');
};

window.openProductGraph = function(baseModel) {
    console.log('📊 Открываем график для:', baseModel);
    showToast(`📊 График для: ${baseModel}`, 'success');
};

window.openProductEdit = function(baseModel) {
    console.log('✏️ Редактируем:', baseModel);
    showToast(`✏️ Редактирование: ${baseModel}`, 'success');
};

// ============================================================
// ОБНОВЛЕНИЕ ПРИ ИЗМЕНЕНИИ ФИЛЬТРОВ
// ============================================================

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
    // Обновляем активную кнопку
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });
    renderProductList();
};

// ============================================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ============================================================

// Навешиваем обработчики на переключатели вида
document.addEventListener('DOMContentLoaded', function() {
    const gridBtn = document.getElementById('viewGridBtn');
    const listBtn = document.getElementById('viewListBtn');
    
    if (gridBtn) {
        gridBtn.addEventListener('click', () => window.toggleViewMode('grid'));
    }
    if (listBtn) {
        listBtn.addEventListener('click', () => window.toggleViewMode('list'));
    }
});

// ============================================================
// ЭКСПОРТ
// ============================================================

export default renderProductList;
