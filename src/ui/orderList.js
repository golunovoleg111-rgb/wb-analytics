// ============================================================
// UI: ORDER LIST — СТРАНИЦА "ЗАКАЗЫ"
// Отображает рекомендации по закупкам + корзина
// ============================================================

import SupplyService from '../services/SupplyService.js';
import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';

// ============================================================
// СОСТОЯНИЕ: КОРЗИНА ЗАКАЗОВ
// ============================================================

let orderCart = [];

// ============================================================
// ОТРИСОВКА СТРАНИЦЫ
// ============================================================

export async function renderOrderList() {
    console.log('📋 Рендеринг страницы "Заказы"...');
    
    const container = document.getElementById('ordersList');
    if (!container) {
        console.warn('⚠️ Контейнер ordersList не найден');
        return;
    }
    
    const summaryContainer = document.getElementById('ordersSummary');
    const emptyContainer = document.getElementById('ordersEmpty');
    const contentContainer = document.getElementById('ordersContent');
    
    try {
        // Загружаем рекомендации
        const recommendations = await SupplyService.calculateRecommendations();
        
        console.log(`📋 Найдено ${recommendations.length} рекомендаций`);
        
        if (recommendations.length === 0) {
            if (emptyContainer) emptyContainer.style.display = 'block';
            if (contentContainer) contentContainer.style.display = 'none';
            return;
        }
        
        if (emptyContainer) emptyContainer.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block';
        
        // Считаем статистику по срочности
        const critical = recommendations.filter(r => r.urgency === 'critical');
        const soon = recommendations.filter(r => r.urgency === 'soon');
        const normal = recommendations.filter(r => r.urgency === 'normal');
        
        // Рендерим сводку
        if (summaryContainer) {
            summaryContainer.innerHTML = `
                <div style="display:flex;gap:14px;flex-wrap:wrap;">
                    <div class="orders-summary-card critical">
                        <div class="orders-summary-value" style="color:#EF4444;">${critical.length}</div>
                        <div class="orders-summary-label">🔴 Срочно</div>
                    </div>
                    <div class="orders-summary-card soon">
                        <div class="orders-summary-value" style="color:#F59E0B;">${soon.length}</div>
                        <div class="orders-summary-label">🟡 Скоро</div>
                    </div>
                    <div class="orders-summary-card normal">
                        <div class="orders-summary-value" style="color:#10B981;">${normal.length}</div>
                        <div class="orders-summary-label">🟢 Норма</div>
                    </div>
                    <div style="flex:1;text-align:right;padding:10px 14px;">
                        <button class="btn btn-primary btn-sm" onclick="window.createSupplyOrderFromCart()">
                            🛒 Создать поставку (${orderCart.length})
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Рендерим список рекомендаций
        let html = '';
        
        recommendations.forEach((rec, index) => {
            const urgencyIcon = rec.urgency === 'critical' ? '🔴' : 
                               rec.urgency === 'soon' ? '🟡' : '🟢';
            const urgencyLabel = rec.urgency === 'critical' ? 'Срочно' : 
                                rec.urgency === 'soon' ? 'Скоро' : 'Норма';
            const borderColor = rec.urgency === 'critical' ? '#EF4444' : 
                               rec.urgency === 'soon' ? '#F59E0B' : '#10B981';
            
            const inCart = orderCart.some(item => item.productId === rec.productId);
            
            html += `
                <div class="product-group" style="border-left:4px solid ${borderColor};">
                    <div class="product-group-header" onclick="window.toggleGroup(this)">
                        <span class="product-group-icon">${urgencyIcon}</span>
                        <div class="product-group-info">
                            <div class="product-group-name">
                                ${rec.article || 'Без артикула'}
                                <span style="font-size:10px;color:var(--text-muted);font-weight:400;margin-left:8px;">
                                    ${urgencyLabel}
                                </span>
                            </div>
                            <div class="product-group-category">
                                Остаток: ${rec.currentStock} шт · 
                                Продажи/д: ${rec.dailyDemand} · 
                                Дней до 0: ${rec.daysToStockout}
                            </div>
                        </div>
                        <div class="product-group-metrics">
                            <div class="product-group-metric">
                                <div class="product-group-metric-label">Рекомендуемый заказ</div>
                                <div class="product-group-metric-value">${rec.recommendedQuantity} шт</div>
                            </div>
                            <div class="product-group-metric">
                                <div class="product-group-metric-label">ИО</div>
                                <div class="product-group-metric-value" style="color:${rec.io < 0.5 ? '#EF4444' : rec.io < 1 ? '#F59E0B' : '#10B981'};">${rec.io}</div>
                            </div>
                        </div>
                        <span class="product-group-arrow">▶</span>
                    </div>
                    <div class="product-group-items">
                        <div style="padding:12px 16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
                            <div style="flex:1;font-size:13px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                                <div>📊 Продажи 30д: <strong>${rec.sales30 || 0}</strong></div>
                                <div>📦 Страховой запас: <strong>${rec.safetyStock || 0}</strong></div>
                                <div>📈 Дневной спрос: <strong>${rec.dailyDemand.toFixed(1)}</strong></div>
                            </div>
                            <div style="display:flex;gap:6px;">
                                <button class="btn ${inCart ? 'btn-success' : 'btn-primary'} btn-sm" 
                                        onclick="window.toggleOrderCart('${rec.productId}', '${rec.article || ''}', ${rec.recommendedQuantity})">
                                    ${inCart ? '✅ В корзине' : '➕ Добавить'}
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="window.adjustOrderQuantity('${rec.productId}', -5)">−5</button>
                                <button class="btn btn-secondary btn-sm" onclick="window.adjustOrderQuantity('${rec.productId}', 5)">+5</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        console.log('✅ Страница "Заказы" отрендерена');
        
    } catch (error) {
        console.error('❌ Ошибка при рендеринге заказов:', error.message);
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
// УПРАВЛЕНИЕ КОРЗИНОЙ
// ============================================================

window.toggleOrderCart = function(productId, article, quantity) {
    const index = orderCart.findIndex(item => item.productId === productId);
    
    if (index >= 0) {
        orderCart.splice(index, 1);
        console.log(`❌ Убран из корзины: ${article}`);
    } else {
        orderCart.push({
            productId,
            article,
            quantity: quantity || 10
        });
        console.log(`✅ Добавлен в корзину: ${article} (${quantity} шт)`);
    }
    
    // Обновляем страницу
    renderOrderList();
};

window.adjustOrderQuantity = function(productId, delta) {
    const item = orderCart.find(i => i.productId === productId);
    if (item) {
        const newQuantity = Math.max(1, item.quantity + delta);
        item.quantity = newQuantity;
        console.log(`📦 ${item.article}: количество ${newQuantity} шт`);
        renderOrderList();
    }
};

// ============================================================
// СОЗДАНИЕ ПОСТАВКИ ИЗ КОРЗИНЫ
// ============================================================

window.createSupplyOrderFromCart = async function() {
    if (orderCart.length === 0) {
        alert('Корзина пуста. Добавьте товары в корзину.');
        return;
    }
    
    if (!confirm(`Создать поставку из ${orderCart.length} товаров?`)) {
        return;
    }
    
    try {
        const recommendations = orderCart.map(item => ({
            productId: item.productId,
            recommendedQuantity: item.quantity
        }));
        
        const order = await SupplyService.createOrderFromRecommendations(recommendations);
        
        console.log('✅ Поставка создана:', order);
        alert(`✅ Поставка #${order.number} создана!`);
        
        // Очищаем корзину
        orderCart = [];
        renderOrderList();
        
    } catch (error) {
        console.error('❌ Ошибка создания поставки:', error.message);
        alert('❌ Ошибка: ' + error.message);
    }
};

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

export default renderOrderList;
