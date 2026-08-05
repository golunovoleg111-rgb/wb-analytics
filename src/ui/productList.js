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
    status: 'all',
    warehouse: 'all'
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
    
    console.log(`📦 Загружено: ${allProducts.length} товаров`);
    console.log(`📦 Загружено: ${Object.keys(allStock).length} записей остатков`);
    console.log(`📦 Загружено: ${Object.keys(allSales).length} записей продаж`);
}

// ============================================================
// ГРУППИРОВКА ПО БАЗЕ АРТИКУЛА
// ============================================================

function groupByBase(products) {
    const groups = {};
    
    products.forEach(product => {
        const base = product.baseModel || product.article;
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
                status: 'normal'
            };
        }
        
        const group = groups[base];
        group.products.push(product);
        
        // Добавляем размер и цвет
        if (product.size && product.size !== 'NOSIZE') {
            group.sizes.add(product.size);
        }
        if (product.color && product.color !== 'NOCOLOR') {
            group.colors.add(product.color);
        }
        
        // Считаем остатки
        const stock = allStock[product.id] || allStock[product.articleKey] || { available: 0 };
        const available = stock.available || 0;
        group.totalStock += available;
        
        // Считаем продажи
        const sales = allSales[product.id] || allSales[product.articleKey] || { orders: 0 };
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
    
    // Вычисляем статус для каждой группы
    Object.values(groups).forEach(group => {
        // ИО = остаток / (продажи за 30 дней / 30)
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
    const { search, status, warehouse } = currentFilters;
    
    return groups.filter(group => {
        // Поиск
        if (search) {
            const query = search.toLowerCase();
            const match = group.baseModel.toLowerCase().includes(query) ||
                         group.name.toLowerCase().includes(query) ||
                         group.products.some(p => p.article.toLowerCase().includes(query));
            if (!match) return false;
        }
        
        // Статус
        if (status !== 'all' && group.status !== status) {
            return false;
        }
        
        // Склад (пока пропускаем, т.к. данные по складам ещё не подключены)
        // TODO: добавить фильтр по складу
        
        return true;
    });
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
    
    // Получаем все размеры и цвета
    const sizes = Array.from(group.sizes).sort();
    const colors = Array.from(group.colors);
    
    // Цена: показываем диапазон или одну цену
    const priceDisplay = group.minPrice === group.maxPrice 
        ? `${group.minPrice.toLocaleString()} ₽`
        : `${group.minPrice.toLocaleString()} — ${group.maxPrice.toLocaleString()} ₽`;
    
    // Маржа: диапазон
    const marginDisplay = group.minMargin === group.maxMargin
        ? `${group.minMargin}%`
        : `${group.minMargin}% — ${group.maxMargin}%`;
    
    // ИО
    const ioDisplay = group.io >= 999 ? '∞' : group.io.toFixed(1);
    
    return `
        <div class="product-group" data-base="${group.baseModel}" style="border-left:4px solid ${statusInfo.color};">
            <div class="product-group-header" onclick="window.toggleGroup(this)">
                <span class="product-group-icon">${statusInfo.icon}</span>
                <div class="product-group-info">
                    <div class="product-group-name">
                        ${group.baseModel}
                        <span style="font-size:12px;font-weight:400;color:var(--text-secondary);margin-left:8px;">
                            ${group.name}
                        </span>
                    </div>
                    <div class="product-group-category">
                        ${sizes.length > 0 ? `Размеры: ${sizes.join(', ')}` : 'Размер: NOSIZE'}
                        ${colors.length > 0 ? ` · Цвета: ${colors.length}` : ''}
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
                        <div class="product-group-metric-value" style="color:${group.maxMargin > 20 ? '#10B981' : '#F59E0B'};">${marginDisplay}</div>
                    </div>
                    <div class="product-group-metric">
                        <div class="product-group-metric-label">ИО</div>
                        <div class="product-group-metric-value">${ioDisplay}</div>
                    </div>
                </div>
                <span class="product-group-arrow">▶</span>
            </div>
            <div class="product-group-items">
                <div style="padding:12px 16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;flex:1;">
                        <span style="font-size:11px;color:var(--text-secondary);font-weight:500;">Размер:</span>
                        <select class="product-size-select" data-base="${group.baseModel}" style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:12px;background:var(--bg-input);">
                            ${sizes.length > 0 ? sizes.map(s => `<option value="${s}">${s}</option>`).join('') : '<option value="NOSIZE">NOSIZE</option>'}
                        </select>
                        ${colors.length > 0 ? `
                            <span style="font-size:11px;color:var(--text-secondary);font-weight:500;margin-left:8px;">Цвет:</span>
                            <select class="product-color-select" data-base="${group.baseModel}" style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:12px;background:var(--bg-input);">
                                ${colors.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        ` : ''}
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
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
// ОСНОВНАЯ ФУНКЦИЯ РЕНДЕРИНГА
// ============================================================

export async function renderProductList() {
    console.log('📦 Рендеринг списка товаров...');
    
    const container = document.getElementById('productsGroupedList');
    const emptyContainer = document.getElementById('productsEmpty');
    const contentContainer = document.getElementById('productsContent');
    
    if (!container) {
        console.warn('⚠️ Контейнер productsGroupedList не найден');
        return;
    }
    
    try {
        await loadData();
        
        if (allProducts.length === 0) {
            if (emptyContainer) emptyContainer.style.display = 'block';
            if (contentContainer) contentContainer.style.display = 'none';
            return;
        }
        
        if (emptyContainer) emptyContainer.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block';
        
        // Группируем
        let groups = groupByBase(allProducts);
        
        // Применяем фильтры
        groups = filterGroups(groups);
        
        // Сортируем по статусу (дефицит → внимание → норма → нет остатков)
        const statusOrder = { deficit: 0, warning: 1, normal: 2, no_stock: 3 };
        groups.sort((a, b) => (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0));
        
        if (groups.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align:center;padding:30px;color:var(--text-secondary);">
                    <div style="font-size:36px;margin-bottom:8px;">🔍</div>
                    <div style="font-size:14px;font-weight:500;">Ничего не найдено</div>
                    <div style="font-size:12px;">Попробуйте изменить параметры поиска</div>
                </div>
            `;
            return;
        }
        
        // Рендерим карточки
        container.innerHTML = groups.map(group => renderGroupCard(group)).join('');
        
        // Обновляем счётчик
        const countEl = document.querySelector('.products-count');
        if (countEl) {
            countEl.textContent = `${groups.length} товаров`;
        }
        
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
    if (items.classList.contains('open')) {
        items.classList.remove('open');
        arrow.classList.remove('open');
    } else {
        items.classList.add('open');
        arrow.classList.add('open');
    }
};

window.openProductCard = function(baseModel) {
    console.log('📋 Открываем карточку товара:', baseModel);
    // TODO: переход на страницу product-card
    // пока просто показываем уведомление
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

// ============================================================
// ЭКСПОРТ
// ============================================================

export default renderProductList;
