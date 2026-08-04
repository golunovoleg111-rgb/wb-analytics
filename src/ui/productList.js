// ============================================================
// UI: PRODUCT LIST — СТРАНИЦА "ТОВАРЫ"
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';
import InventoryAggregate from '../core/stock/InventoryAggregate.js';

// ============================================================
// ОТКРЫТИЕ КАРТОЧКИ ТОВАРА
// ============================================================

window.openProductCard = function(article) {
    console.log('📦 Открываем карточку товара:', article);
    alert(`Открываем карточку товара: ${article}`);
};

// ============================================================
// ОТРИСОВКА СПИСКА ТОВАРОВ
// ============================================================

export async function renderProductList() {
    console.log('📦 Рендеринг списка товаров...');
    
    const container = document.getElementById('productsGroupedList');
    if (!container) {
        console.warn('⚠️ Контейнер productsGroupedList не найден');
        return;
    }
    
    try {
        // Загружаем все данные параллельно
        const [products, salesAggregated, stockAggregated] = await Promise.all([
            ProductService.getActive(),
            SalesService.getAllAggregated(30),
            StockService.getAllAggregated()
        ]);
        
        console.log(`📦 Найдено ${products.length} товаров`);
        console.log(`📊 Продажи: ${Object.keys(salesAggregated).length} товаров с продажами`);
        console.log(`📦 Остатки: ${Object.keys(stockAggregated).length} товаров с остатками`);
        
        if (products.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align:center;padding:30px;">
                    <div style="font-size:36px;margin-bottom:10px;">📦</div>
                    <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Нет товаров</div>
                    <div style="font-size:13px;color:var(--text-secondary);">
                        Загрузите тестовые данные или импортируйте товары
                    </div>
                </div>
            `;
            return;
        }
        
        // Группируем товары по baseArticle
        const groups = {};
        products.forEach(product => {
            const key = product.baseArticle || product.article;
            if (!groups[key]) {
                groups[key] = {
                    baseArticle: key,
                    category: product.category || 'Товар',
                    items: []
                };
            }
            groups[key].items.push(product);
        });
        
        function getCategoryIcon(category) {
            const icons = {
                'Костюмы': '👔',
                'Платья': '👗',
                'Жакеты': '🧥',
                'Брюки': '👖',
                'Свитеры': '🧶',
                'Товар': '📦'
            };
            return icons[category] || '📦';
        }
        
        // Получаем все склады для отображения
        const warehouses = await StockService.getWarehouses();
        
        let html = '';
        Object.keys(groups).forEach(key => {
            const group = groups[key];
            const icon = getCategoryIcon(group.category);
            
            html += `
                <div class="product-group">
                    <div class="product-group-header" onclick="window.toggleGroup(this)">
                        <span class="product-group-icon">${icon}</span>
                        <div class="product-group-info">
                            <div class="product-group-name">${group.baseArticle}</div>
                            <div class="product-group-category">${group.category} · ${group.items.length} вар.</div>
                        </div>
                        <div class="product-group-metrics">
                            <div class="product-group-metric">
                                <div class="product-group-metric-label">Товаров</div>
                                <div class="product-group-metric-value">${group.items.length}</div>
                            </div>
                        </div>
                        <span class="product-group-arrow">▶</span>
                    </div>
                    <div class="product-group-items">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;padding:8px 14px;font-size:10px;color:var(--text-muted);border-bottom:1px solid var(--border);font-weight:600;">
                            <span>Артикул</span>
                            <span>Цена</span>
                            <span>Продажи 30д</span>
                            <span>Выручка</span>
                            <span>Остаток</span>
                            <span>ИО</span>
                            <span>Локализация</span>
                            <span>Статус</span>
                        </div>
                        ${group.items.map(product => {
                            const sales = salesAggregated[product.id] || { orders: 0, revenue: 0 };
                            const stock = stockAggregated[product.id] || { total: 0, available: 0, byWarehouse: {} };
                            
                            // Рассчитываем ИО
                            const sales30 = sales.orders || 0;
                            const wbStock = stock.available || 0;
                            const io = InventoryAggregate.calculateIO(wbStock, sales30);
                            const ioStatus = InventoryAggregate.getIOStatus(io);
                            
                            // Индекс локализации (упрощённо)
                            const totalSales = sales30;
                            const salesFromStock = Object.values(stock.byWarehouse || {}).reduce((sum, w) => sum + (w.available || 0), 0);
                            const localizationIndex = totalSales > 0 
                                ? Math.min(100, Math.round((salesFromStock / totalSales) * 100)) 
                                : 0;
                            
                            return `
                                <div class="product-group-item" onclick="window.openProductCard('${product.article}')" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;padding:6px 14px;gap:0;cursor:pointer;border-bottom:1px solid var(--border-light);">
                                    <span class="product-group-item-name" style="font-weight:500;">${product.article}</span>
                                    <span>—</span>
                                    <span style="color:${sales.orders > 0 ? '#10B981' : '#9CA3AF'};">${sales.orders || 0}</span>
                                    <span style="color:${sales.revenue > 0 ? '#10B981' : '#9CA3AF'};">${sales.revenue.toLocaleString()} ₽</span>
                                    <span style="color:${wbStock > 0 ? '#10B981' : '#EF4444'};">${wbStock}</span>
                                    <span style="color:${ioStatus.color};">${io > 0 ? io.toFixed(1) : '—'}</span>
                                    <span style="color:${localizationIndex > 70 ? '#10B981' : localizationIndex > 30 ? '#F59E0B' : '#EF4444'};">${localizationIndex}%</span>
                                    <span>${product.isActive() ? '🟢' : '🔴'}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        console.log('✅ Список товаров отрендерен');
        
        document.getElementById('productsEmpty').style.display = 'none';
        document.getElementById('productsContent').style.display = 'block';
        
    } catch (error) {
        console.error('❌ Ошибка при рендеринге товаров:', error.message);
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:30px;color:#EF4444;">
                <div style="font-size:36px;margin-bottom:10px;">❌</div>
                <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Ошибка загрузки</div>
                <div style="font-size:13px;color:var(--text-secondary);">${error.message}</div>
            </div>
        `;
    }
}

// ============================================================
// ФУНКЦИЯ ДЛЯ РАСКРЫТИЯ ГРУПП
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

export default renderProductList;
