// ============================================================
// SUPPLY ORDER — ЗАКАЗ ПОСТАВЩИКУ
// ============================================================

class SupplyOrder {
    constructor(data) {
        this.id = data.id || this._generateId();
        this.number = data.number || `PO-${Date.now().toString(36).toUpperCase()}`;
        this.status = data.status || 'draft'; // draft | confirmed | ordered | in_transit | received | shipped_to_wb
        this.orderDate = data.orderDate || null;
        this.supplier = data.supplier || '';
        this.expectedDeliveryDate = data.expectedDeliveryDate || null;
        this.deliveryDate = data.deliveryDate || null;
        this.items = data.items || [];
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // ============================================================
    // УПРАВЛЕНИЕ ПОЗИЦИЯМИ
    // ============================================================

    addItem(productId, quantity, recommended = 0, price = 0) {
        // Проверяем, есть ли уже такая позиция
        const existing = this.items.find(i => i.productId === productId);
        if (existing) {
            existing.quantity += quantity;
            existing.recommended = recommended || existing.recommended;
            return this;
        }

        this.items.push({
            id: this._generateId(),
            productId,
            quantity,
            recommended: recommended || quantity,
            price: price || 0,
            receivedQuantity: 0,
            status: 'pending' // pending | received | partially_received
        });

        this.updatedAt = new Date().toISOString();
        return this;
    }

    removeItem(itemId) {
        this.items = this.items.filter(i => i.id !== itemId);
        this.updatedAt = new Date().toISOString();
        return this;
    }

    updateItemQuantity(itemId, quantity) {
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            item.quantity = quantity;
            this.updatedAt = new Date().toISOString();
        }
        return this;
    }

    // ============================================================
    // ИЗМЕНЕНИЕ СТАТУСА
    // ============================================================

    confirm() {
        if (this.status !== 'draft') {
            throw new Error('Можно подтвердить только черновик');
        }
        if (this.items.length === 0) {
            throw new Error('Нельзя подтвердить пустой заказ');
        }
        this.status = 'confirmed';
        this.orderDate = new Date().toISOString().split('T')[0];
        this.updatedAt = new Date().toISOString();
        return this;
    }

    markOrdered() {
        if (this.status !== 'confirmed') {
            throw new Error('Можно отправить только подтверждённый заказ');
        }
        this.status = 'ordered';
        this.updatedAt = new Date().toISOString();
        return this;
    }

    markInTransit() {
        if (this.status !== 'ordered') {
            throw new Error('Можно отметить в пути только отправленный заказ');
        }
        this.status = 'in_transit';
        this.updatedAt = new Date().toISOString();
        return this;
    }

    receiveItems(itemId, quantity) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) {
            throw new Error(`Позиция ${itemId} не найдена`);
        }

        const received = Math.min(quantity, item.quantity - item.receivedQuantity);
        item.receivedQuantity += received;
        item.status = item.receivedQuantity >= item.quantity ? 'received' : 'partially_received';

        // Проверяем, все ли позиции получены
        const allReceived = this.items.every(i => i.status === 'received');
        if (allReceived) {
            this.status = 'received';
            this.deliveryDate = new Date().toISOString().split('T')[0];
        }

        this.updatedAt = new Date().toISOString();
        return this;
    }

    markShipped() {
        if (this.status !== 'received') {
            throw new Error('Можно отгрузить только полученный заказ');
        }
        this.status = 'shipped_to_wb';
        this.updatedAt = new Date().toISOString();
        return this;
    }

    // ============================================================
    // ПОЛУЧЕНИЕ ДАННЫХ
    // ============================================================

    getTotalItems() {
        return this.items.reduce((sum, i) => sum + i.quantity, 0);
    }

    getTotalReceived() {
        return this.items.reduce((sum, i) => sum + i.receivedQuantity, 0);
    }

    getTotalPrice() {
        return this.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    }

    getStatusLabel() {
        const labels = {
            'draft': '📋 Черновик',
            'confirmed': '✅ Подтверждён',
            'ordered': '📦 Заказан',
            'in_transit': '🚛 В пути',
            'received': '📥 Получен',
            'shipped_to_wb': '📤 Отгружен в WB'
        };
        return labels[this.status] || this.status;
    }

    // ============================================================
    // СТАТИЧЕСКИЙ МЕТОД — СОЗДАНИЕ ИЗ РЕКОМЕНДАЦИЙ
    // ============================================================

    static createFromRecommendations(recommendations, supplier = '') {
        const order = new SupplyOrder({ supplier });
        recommendations.forEach(rec => {
            order.addItem(rec.productId, rec.recommendedQuantity, rec.recommendedQuantity);
        });
        return order;
    }

    // ============================================================
    // СЕРИАЛИЗАЦИЯ
    // ============================================================

    toJSON() {
        return {
            id: this.id,
            number: this.number,
            status: this.status,
            orderDate: this.orderDate,
            supplier: this.supplier,
            expectedDeliveryDate: this.expectedDeliveryDate,
            deliveryDate: this.deliveryDate,
            items: this.items,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

export default SupplyOrder;
