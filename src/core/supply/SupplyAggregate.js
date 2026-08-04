// ============================================================
// SUPPLY AGGREGATE — УПРАВЛЕНИЕ ЗАКАЗАМИ
// ============================================================

import SupplyOrder from './SupplyOrder.js';
import { Database } from '../../infrastructure/db.js';

class SupplyAggregate {
    
    // ============================================================
    // СОЗДАНИЕ
    // ============================================================

    static async create(data) {
        const order = new SupplyOrder(data);
        await Database.save(Database.STORES.SUPPLY, order);
        return order;
    }

    static async createFromRecommendations(recommendations, supplier = '') {
        const order = SupplyOrder.createFromRecommendations(recommendations, supplier);
        await Database.save(Database.STORES.SUPPLY, order);
        return order;
    }

    // ============================================================
    // ЧТЕНИЕ
    // ============================================================

    static async getById(id) {
        const data = await Database.getById(Database.STORES.SUPPLY, id);
        if (!data) return null;
        return new SupplyOrder(data);
    }

    static async getAll() {
        const all = await Database.getAll(Database.STORES.SUPPLY);
        return all.map(d => new SupplyOrder(d));
    }

    static async getByStatus(status) {
        const all = await this.getAll();
        return all.filter(order => order.status === status);
    }

    static async getActive() {
        const all = await this.getAll();
        const activeStatuses = ['draft', 'confirmed', 'ordered', 'in_transit'];
        return all.filter(order => activeStatuses.includes(order.status));
    }

    static async getByProduct(productId) {
        const all = await this.getAll();
        return all.filter(order => 
            order.items.some(item => item.productId === productId)
        );
    }

    // ============================================================
    // ОБНОВЛЕНИЕ
    // ============================================================

    static async update(id, data) {
        const order = await this.getById(id);
        if (!order) {
            throw new Error(`Заказ ${id} не найден`);
        }

        if (order.status !== 'draft' && order.status !== 'confirmed') {
            throw new Error(`Нельзя изменить заказ в статусе ${order.status}`);
        }

        Object.assign(order, data);
        order.updatedAt = new Date().toISOString();
        await Database.save(Database.STORES.SUPPLY, order);
        return order;
    }

    static async addItem(orderId, productId, quantity, price = 0) {
        const order = await this.getById(orderId);
        if (!order) {
            throw new Error(`Заказ ${orderId} не найден`);
        }

        if (order.status !== 'draft' && order.status !== 'confirmed') {
            throw new Error(`Нельзя добавить позицию в заказ со статусом ${order.status}`);
        }

        order.addItem(productId, quantity, quantity, price);
        await Database.save(Database.STORES.SUPPLY, order);
        return order;
    }

    static async removeItem(orderId, itemId) {
        const order = await this.getById(orderId);
        if (!order) {
            throw new Error(`Заказ ${orderId} не найден`);
        }

        if (order.status !== 'draft' && order.status !== 'confirmed') {
            throw new Error(`Нельзя удалить позицию из заказа со статусом ${order.status}`);
        }

        order.removeItem(itemId);
        await Database.save(Database.STORES.SUPPLY, order);
        return order;
    }

    // ============================================================
    // ИЗМЕНЕНИЕ СТАТУСА
    // ============================================================

    static async confirm(orderId) {
        const order = await this.getById(orderId);
        if (!order) {
            throw new Error(`Заказ ${orderId} не найден`);
        }
        order.confirm();
        await Database.save(Database.STORES.SUPPLY, order);
        return order;
    }

    static async markOrdered(orderId) {
        const order = await this.getById(orderId);
        if (!order) {
            throw new Error(`Заказ ${orderId} не найден`);
        }
        order.markOrdered();
        await Database.save(Database.STORES.SUPPLY, order);
        return order;
    }

    static async markInTransit(orderId) {
        const order = await this.getById(orderId);
        if (!order) {
            throw new Error(`Заказ ${orderId} не найден`);
        }
        order.markInTransit();
        await Database.save(Database.STORES.SUPPLY, order);
        return order;
    }

    static async receiveItems(orderId, itemId, quantity) {
        const order = await this.getById(orderId);
        if (!order) {
            throw new Error(`Заказ ${orderId} не найден`);
        }
        order.receiveItems(itemId, quantity);
        await Database.save(Database.STORES.SUPPLY, order);
        return order;
    }

    static async markShipped(orderId) {
        const order = await this.getById(orderId);
        if (!order) {
            throw new Error(`Заказ ${orderId} не найден`);
        }
        order.markShipped();
        await Database.save(Database.STORES.SUPPLY, order);
        return order;
    }

    // ============================================================
    // УДАЛЕНИЕ
    // ============================================================

    static async delete(orderId) {
        const order = await this.getById(orderId);
        if (!order) {
            throw new Error(`Заказ ${orderId} не найден`);
        }

        if (order.status !== 'draft') {
            throw new Error(`Нельзя удалить заказ в статусе ${order.status}`);
        }

        await Database.delete(Database.STORES.SUPPLY, orderId);
    }

    static async clearAll() {
        await Database.clear(Database.STORES.SUPPLY);
    }
}

export default SupplyAggregate;
