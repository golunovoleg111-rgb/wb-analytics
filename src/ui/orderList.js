// ============================================================
// UI: ORDER LIST — ПЛАНИРОВАНИЕ ЗАКУПОК
// ============================================================

import SupplyService from '../services/SupplyService.js';
import ProductService from '../services/ProductService.js';

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let orderCart = [];
let recommendationsCache = [];

// ============================================================
// ОТРИСОВКА
// ============================================================

export async function renderOrderList() {
    console.log('📋 Рендеринг страницы "Планирование закупок"...');
    
    const container = document.getElementById('ordersList');
    if (!container) return;
    
    const summaryContainer = document.getElementById('ordersSummary');
    const emptyContainer = document.getElementById('ordersEmpty');
    const contentContainer = document.getElementById('ordersContent');
    
    try {
        recommendationsCache = await SupplyService.calculateRecommendations();
        
        if (recommendationsCache.length === 0) {
            if (emptyContainer) emptyContainer.style.display = 'block';
            if (contentContainer) contentContainer.style.display = 'none';
            return;
        }
        
        if (emptyContainer) emptyContainer.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block';
        
        // Сводка
        const critical = recommendationsCache.filter(r => r.urgency === 'critical');
        const soon = recommendationsCache.filter(r => r.urgency === 'soon');
        const normal = recommendationsCache.filter(r => r.urgency === 'normal');
        const totalItems = orderCart.reduce((sum, item) => sum + item.quantity, 0);
        
        if (summaryContainer) {
            summaryContainer.innerHTML = `
                <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
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
                    <div style="flex:1;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="window.addAllToCart()">
                            ➕ Добавить все
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="window.createSupplyOrderFromCart()">
                            🛒 Создать поставку (${orderCart.length} / ${totalItems} шт)
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="window.exportSupplyOrder()">
                            📤 Экспорт для WB
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Список рекомендаций
        let html = '';
        
        recommendationsCache.forEach((rec) => {
            const borderColor = rec.urgency === 'critical' ? '#EF4444' : 
                               rec.urgency === 'soon' ? '#F59E0B' : '#10B981';
            const urgencyIcon = rec.urgency === 'critical' ? '🔴' : 
                               rec.urgency === 'soon' ? '🟡' : '🟢';
            
            const cartItem = orderCart.find(item => item.productId === rec.productId);
            const cartQuantity = cartItem ? cartItem.quantity : 0;
            const inCart = cartQuantity > 0;
            
            html += `
                <div class="product-group" style="border-left:4px solid ${borderColor};">
                    <div class="product-group-header" onclick="window.toggleGroup(this)">
                        <span class="product-group-icon">${urgencyIcon}</span>
                        <div class="product-group-info">
                            <div class="product-group-name">
                                ${rec.article || 'Без артикула'}
                                <span style="font-size:10px;color:var(--text-muted);font-weight:400;margin-left:8px;">
                                    ${rec.urgency === 'critical' ? 'Срочно' : rec.urgency === 'soon' ? 'Скоро' : 'Норма'}
                                </span>
                            </div>
                            <div class="product-group-category">
                                Остаток: ${rec.currentStock} шт · Продажи/д: ${rec.dailyDemand} · Дней: ${rec.daysToStockout}
                            </div>
                        </div>
                        <div class="product-group-metrics">
                            <div class="product-group-metric">
                                <div class="product-group-metric-label">Рекомендуемый заказ</div>
                                <div class="product-group-metric-value">${rec.recommendedQuantity} шт</div>
                            </div>
                            <div class="product-group-metric">
                                <div class="product-group-metric-label">В корзине</div>
                                <div class="product-group-metric-value" style="color:${inCart ? '#10B981' : '#9CA3AF'};">
                                    ${inCart ? cartQuantity + ' шт' : '—'}
                                </div>
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
                            <div style="display:flex;gap:6px;align-items:center;">
                                <button class="btn btn-sm btn-secondary" onclick="window.adjustOrderQuantity('${rec.productId}', -5)">−5</button>
                                <input type="number" id="qty_${rec.productId}" 
                                       value="${inCart ? cartQuantity : rec.recommendedQuantity}" 
                                       min="0" max="999"
                                       style="width:60px;text-align:center;padding:4px;font-size:12px;"
                                       onchange="window.updateCartQuantity('${rec.productId}', this.value)">
                                <button class="btn btn-sm btn-secondary" onclick="window.adjustOrderQuantity('${rec.productId}', 5)">+5</button>
                                <button class="btn ${inCart ? 'btn-success' : 'btn-primary'} btn-sm" 
                                        onclick="window.toggleOrderCart('${rec.productId}', '${rec.article || ''}', document.getElementById('qty_${rec.productId}').value)">
                                    ${inCart ? '✅ В корзине' : '➕ Добавить'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        console.log('✅ Страница "Планирование закупок" отрендерена');
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
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
    const qty = parseInt(quantity) || 10;
    const index = orderCart.findIndex(item => item.productId === productId);
    
    if (index >= 0) {
        orderCart.splice(index, 1);
    } else {
        orderCart.push({ productId, article, quantity: qty });
    }
    
    renderOrderList();
};

window.updateCartQuantity = function(productId, value) {
    const qty = parseInt(value) || 0;
    const item = orderCart.find(i => i.productId === productId);
    if (item) {
        if (qty <= 0) {
            orderCart = orderCart.filter(i => i.productId !== productId);
        } else {
            item.quantity = qty;
        }
    }
    renderOrderList();
};

window.adjustOrderQuantity = function(productId, delta) {
    const item = orderCart.find(i => i.productId === productId);
    if (item) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty <= 0) {
            orderCart = orderCart.filter(i => i.productId !== productId);
        } else {
            item.quantity = newQty;
        }
    } else {
        // Если товара нет в корзине, добавляем с базовым количеством
        const rec = recommendationsCache.find(r => r.productId === productId);
        if (rec) {
            const qty = Math.max(1, rec.recommendedQuantity + delta);
            orderCart.push({ 
                productId, 
                article: rec.article || '', 
                quantity: qty 
            });
        }
    }
    renderOrderList();
};

window.addAllToCart = function() {
    recommendationsCache.forEach(rec => {
        const existing = orderCart.find(item => item.productId === rec.productId);
        if (!existing) {
            orderCart.push({
                productId: rec.productId,
                article: rec.article || '',
                quantity: rec.recommendedQuantity
            });
        }
    });
    renderOrderList();
};

// ============================================================
// СОЗДАНИЕ ПОСТАВКИ
// ============================================================

window.createSupplyOrderFromCart = async function() {
    if (orderCart.length === 0) {
        alert('Корзина пуста');
        return;
    }
    
    if (!confirm(`Создать поставку из ${orderCart.length} товаров?`)) return;
    
    try {
        const recommendations = orderCart.map(item => ({
            productId: item.productId,
            recommendedQuantity: item.quantity
        }));
        
        const order = await SupplyService.createOrderFromRecommendations(recommendations);
        
        alert(`✅ Поставка #${order.number} создана!`);
        orderCart = [];
        renderOrderList();
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
};

// ============================================================
// ЭКСПОРТ В EXCEL
// ============================================================

window.exportSupplyOrder = function() {
    if (orderCart.length === 0) {
        alert('Корзина пуста');
        return;
    }
    
    const data = orderCart.map(item => ({
        'Артикул': item.article || '',
        'Количество': item.quantity,
        'Примечание': ''
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Поставка');
    XLSX.writeFile(wb, `Поставка_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    alert('✅ Файл экспортирован');
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
