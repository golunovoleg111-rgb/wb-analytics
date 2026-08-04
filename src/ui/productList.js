// ============================================================
// UI: PRODUCT LIST — СТРАНИЦА "ТОВАРЫ"
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';

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
        const [products, salesAggregated] = await Promise.all([
            ProductService.getActive(),
            SalesService.getAllAggregated(30)
        ]);
        
        console.log(`📦 Найдено ${products.length} товаров`);
        console.log(`📊 Продажи: ${Object.keys(salesAggregated).length} товаров с продажами`);
        
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
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr 1fr;padding:8px 14px;font-size:10px;color:var(--text-muted);border-bottom:1px solid var(--border);font-weight:600;">
                            <span>Артикул</span>
                            <span>Цена</span>
                            <span>Продажи 30д</span>
                            <span>Выручка</span>
                            <span>Маржа</span>
                            <span>Статус</span>
                        </div>
                        ${group.items.map(product => {
                            const sales = salesAggregated[product.id] || { orders: 0, revenue: 0 };
                            return `
                                <div class="product-group-item" onclick="window.openProductCard('${product.article}')" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr 1fr;padding:6px 14px;gap:0;">
                                    <span class="product-group-item-name" style="font-weight:500;">${product.article}</span>
                                    <span>—</span>
                                    <span style="color:${sales.orders > 0 ? '#10B981' : '#9CA3AF'};">${sales.orders || 0}</span>
                                    <span style="color:${sales.revenue > 0 ? '#10B981' : '#9CA3AF'};">${sales.revenue.toLocaleString()} ₽</span>
                                    <span>—</span>
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
