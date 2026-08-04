// ============================================================
// UI: SUPPLY HISTORY — ИСТОРИЯ ПОСТАВОК
// ============================================================

import SupplyService from '../services/SupplyService.js';

export async function renderSupplyHistory() {
    console.log('📋 Рендеринг истории поставок...');
    
    const container = document.getElementById('supplyHistoryBody');
    if (!container) return;
    
    try {
        const orders = await SupplyService.getOrders();
        
        if (orders.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;padding:30px;color:var(--text-secondary);">
                        <div style="font-size:36px;margin-bottom:8px;">📦</div>
                        <div style="font-size:14px;font-weight:500;">Нет поставок</div>
                        <div style="font-size:12px;color:var(--text-secondary);">
                            Создайте поставку в разделе «Планирование закупок»
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        
        orders.forEach(order => {
            html += `
                <tr>
                    <td>${order.orderDate || order.createdAt.split('T')[0]}</td>
                    <td><strong>${order.number}</strong></td>
                    <td>${order.items.length}</td>
                    <td>${order.getTotalItems()}</td>
                    <td>${order.getStatusLabel()}</td>
                    <td>
                        <button class="btn btn-xs btn-secondary" onclick="window.viewSupplyOrder('${order.id}')">👁️</button>
                        ${order.status === 'draft' ? 
                            `<button class="btn btn-xs btn-primary" onclick="window.confirmSupplyOrder('${order.id}')">✅ Подтвердить</button>` : ''}
                        ${order.status === 'confirmed' ? 
                            `<button class="btn btn-xs btn-warning" onclick="window.markOrdered('${order.id}')">📦 Отправить</button>` : ''}
                    </td>
                </tr>
            `;
        });
        
        container.innerHTML = html;
        console.log('✅ История поставок отрендерена');
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:20px;color:#EF4444;">
                    ❌ Ошибка: ${error.message}
                </td>
            </tr>
        `;
    }
}

window.viewSupplyOrder = async function(orderId) {
    try {
        const order = await SupplyService.getOrderById(orderId);
        if (!order) {
            alert('Заказ не найден');
            return;
        }
        
        let message = `📋 Поставка ${order.number}\n`;
        message += `Статус: ${order.getStatusLabel()}\n`;
        message += `Дата: ${order.orderDate || '—'}\n`;
        message += `\n📦 Позиции:\n`;
        order.items.forEach(item => {
            message += `  - ${item.productId}: ${item.quantity} шт`;
            if (item.receivedQuantity > 0) {
                message += ` (получено ${item.receivedQuantity})`;
            }
            message += `\n`;
        });
        
        alert(message);
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
};

window.confirmSupplyOrder = async function(orderId) {
    if (!confirm('Подтвердить заказ?')) return;
    try {
        await SupplyService.confirmOrder(orderId);
        renderSupplyHistory();
        alert('✅ Заказ подтверждён');
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
};

window.markOrdered = async function(orderId) {
    if (!confirm('Отправить заказ поставщику?')) return;
    try {
        await SupplyService.markOrdered(orderId);
        renderSupplyHistory();
        alert('✅ Заказ отправлен');
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
};

export default renderSupplyHistory;
