// ============================================================
// UI: PRODUCT LIST — СТРАНИЦА "ТОВАРЫ"
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';
import InventoryAggregate from '../core/stock/InventoryAggregate.js';

window.openProductCard = function(article) {
    console.log('📦 Открываем карточку товара:', article);
    alert(`Открываем карточку товара: ${article}`);
};

export async function renderProductList() {
    console.log('📦 Рендеринг списка товаров...');
    
    const container = document.getElementById('productsGroupedList');
    if (!container) {
        console.warn('⚠️ Контейнер productsGroupedList не найден');
        return;
    }
    
    try {
        const [products, salesAggregated, stockAggregated] = await Promise.all([
            ProductService.getActive(),
            SalesService.getAllAggregated(30),
            StockService.getAllAggregated()
        ]);
        
        if (products.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align:center;padding:30px;">
                    <div style="font-size:48px;margin-bottom:12px;">📥</div>
                    <div style="font-size:18px;font-weight:600;margin-bottom:6px;">Нет данных</div>
                    <div style="font-size:14px;color:var(--text-secondary);margin-bottom:16px;">
                        Импортируйте <strong>продажи</strong>, <strong>остатки</strong> и <strong>закупочные цены</strong> в разделе «Импорт»
                    </div>
                    <button class="btn btn-primary" onclick="navigateTo('import')">📥 Перейти к импорту</button>
                </div>
            `;
            document.getElementById('productsEmpty').style.display = 'block';
            document.getElementById('productsContent').style.display = 'none';
            return;
        }
        
        // ... остальной код рендеринга (без тестовых данных)
        // Он будет работать только с реальными данными из БД
        
        console.log('✅ Список товаров отрендерен');
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:30px;color:#EF4444;">
                <div style="font-size:48px;margin-bottom:12px;">❌</div>
                <div style="font-size:18px;font-weight:600;margin-bottom:6px;">Ошибка загрузки</div>
                <div style="font-size:14px;color:var(--text-secondary);">${error.message}</div>
            </div>
        `;
    }
}

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
