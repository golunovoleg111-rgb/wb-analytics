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
    
    // 1. Пробуем по articleKey (точное совпадение)
    if (product.articleKey && dataMap[product.articleKey]) {
        return dataMap[product.articleKey];
    }
    
    // 2. Пробуем по id
    if (product.id && dataMap[product.id]) {
        return dataMap[product.id];
    }
    
    // 3. Пробуем по артикулу + размер + цвет
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
    
    // 4. Ищем частичное совпадение по артикулу (для агрегированных данных)
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
        // Используем article как базу, если baseModel не задан
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
        
        // Размеры и цвета
        if (product.size && product.size !== 'NOSIZE') {
            group.sizes.add(product.size);
        }
        if (product.color && product.color !== 'NOCOLOR') {
            group.colors.add(product.color);
        }
        
        // Остатки
        const stock = getStockForProduct(product);
        const available = stock.available || 0;
        group.totalStock += available;
        
        // Продажи
        const sales = getSalesForProduct(product);
        group.totalSales += sales.orders || 0;
        
        // Цены
        const price = product.price || 0;
        if (price > 0) {
            group.minPrice = Math.min(group.minPrice, price);
            group.maxPrice = Math.max(group.maxPrice, price);
        }
        
        // Закупка
        const purchase = product.purchasePrice || 0;
        if (purchase > 0) {
            group.minPurchase = Math.min(group.minPurchase, purchase);
        }
        
        // Маржа
        const margin = product.margin || 0;
        if (margin > 0) {
            group.minMargin = Math.min(group.minMargin, margin);
            group.maxMargin = Math.max(group.maxMargin, margin);
        }
    });
    
    // Вычисляем статус и ИО
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
    
    console.log(`📦 Сгруппировано: ${Object.values(groups).length} групп`);
    return Object.values(groups);
}

// ============================================================
// ФИЛЬТРАЦИЯ
// ============================================================

function filterGroups(groups) {
    const { search, status } = currentFilters;
    
    return groups.filter(group => {
        // Поиск
        if (search) {
            const query = search.toLowerCase();
            const match = 
                group.baseModel.toLowerCase().includes(query) ||
                group.name.toLowerCase().includes(query) ||
                group.products.some(p => p.article.toLowerCase().includes(query));
            if (!match) return false;
        }
        
        // Статус
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
// ОТРИСОВКА КАРТОЧКИ
// ============================================================

function renderGroupCard(group) {
    const statusLabels = {
        'no_stock': { label: 'Нет остатков', color: '#6B7280', icon: '⚫' },
        'deficit': { label: 'Дефицит', color: '#EF4444', icon: '🔴' },
        'warning': { label: 'Внимание', color: '#F59E0B', icon: '🟡' },
        'normal': { label: 'В наличии', color: '#10B981', icon: '🟢' }
    };
    
    const statusInfo = statusLabels[group.status] || statusLabels['normal'];
    const sizes = Array.from(group.sizes).sort();
    const colors = Array.from(group.colors);
    
    // Цена
    let priceDisplay = '0 ₽';
    if (group.minPrice > 0 && group.minPrice !== Infinity) {
        if (group.minPrice === group.maxPrice) {
            priceDisplay = formatPrice(group.minPrice);
        } else {
            priceDisplay = `${formatPrice(group.minPrice)} — ${formatPrice(group.maxPrice)}`;
        }
    }
    
    // Маржа
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
    const colorsCount = colors.length;

    return `
        <div class="product-group" data-base="${group.baseModel}">
            <div class="product-group-header" onclick="window.toggleGroup(this)">
                <span class="product-group-icon">${statusInfo.icon}</span>
                <div class="product-group-info">
                    <div class="product-group-name">
                        ${group.baseModel}
                        <span class="product-group-subname">${group.name}</span>
                    </div>
                    <div class="product-group-category">
                        ${sizesDisplay}
                        ${colorsCount > 0 ? ` · ${colorsCount} цветов` : ''}
                    </div>
                </div>
                <div class="product-group-metrics">
                    <div class="product-group-metric">
                        <div class="product-group-metric-label">Цена</div>
                        <div class="product-group-metric-value">${priceDisplay}</div>
                    </div>
                    <div class="product-group-metric">
                        <div class="product-group-metric-label">Остаток</div>
                        <div class="product-group-metric-value">${group.totalStock} шт</div>
                    </div>
                    <div class="product-group-metric">
                        <div class="product-group-metric-label">Маржа</div>
                        <div class="product-group-metric-value">${marginDisplay}</div>
                    </div>
                    <div class="product-group-metric">
                        <div class="product-group-metric-label">ИО</div>
                        <div class="product-group-metric-value">${ioDisplay}</div>
                    </div>
                </div>
                <span class="product-group-arrow">▶</span>
            </div>
            <div class="product-group-items">
                <div>
                    <div>
                        ${sizes.length > 0 ? `
                            <span>Размер:</span>
                            <select class="product-size-select" data-base="${group.baseModel}">
                                ${sizes.map(s => `<option value="${s}">${s}</option>`).join('')}
                            </select>
                        ` : ''}
                        ${colors.length > 0 ? `
                            <span>Цвет:</span>
                            <select class="product-color-select" data-base="${group.baseModel}">
                                ${colors.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        ` : ''}
                    </div>
                    <div>
                        <button class="btn btn-sm btn-secondary" onclick="window.openProductGraph('${group.baseModel}')">📊 График</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.openProductEdit('${group.baseModel}')">✏️ Редактировать</button>
                        <button class="btn btn-sm btn-primary" onclick="window.openProductCard('${group.baseModel}')">📋 Открыть</button>
                    </div>
                </div>
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
        
        container.innerHTML = groups.map(group => renderGroupCard(group)).join('');
        console.log(`✅ Отображено ${groups.length} групп товаров`);
        
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

window.toggleGroup = function(header) {
    const items = header.nextElementSibling;
    const arrow = header.querySelector('.product-group-arrow');
    if (!items) return;
    
    if (items.classList.contains('open')) {
        items.classList.remove('open');
        if (arrow) arrow.classList.remove('open');
    } else {
        items.classList.add('open');
        if (arrow) arrow.classList.add('open');
    }
};

window.openProductCard = function(baseModel) {
    console.log('📋 Открываем карточку товара:', baseModel);
    showToast(`📋 Открываем карточку: ${baseModel}`, 'success');
};

window.openProductGraph = function(baseModel) {
    console.log('📊 Открываем график для:', baseModel);
    showToast(`📊 График для: ${baseModel}`, 'success');
};

window.openProductEdit = function(baseModel) {
    console.log('✏️ Редактируем:', baseModel);
    showToast(`✏️ Редактирование: ${baseModel}`, 'success');
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

// ============================================================
// ЭКСПОРТ
// ============================================================

export default renderProductList;
