// ============================================================
// SUPPLY SERVICE — СЕРВИС ДЛЯ UI
// ============================================================

import SupplyAggregate from '../core/supply/SupplyAggregate.js';
import InventoryAggregate from '../core/stock/InventoryAggregate.js';
import ProductService from './ProductService.js';
import StockService from './StockService.js';
import SalesService from './SalesService.js';

class SupplyService {
    
    // ============================================================
    // РАСЧЁТ РЕКОМЕНДАЦИЙ
    // ============================================================

    /**
     * Рассчитать рекомендуемый заказ для всех товаров
     */
    static async calculateRecommendations(settings) {
        const targetStockDays = settings?.targetStockDays || 60;
        const safetyStockDays = settings?.safetyStockDays || 30;
        const deliveryDays = settings?.deliveryDays || 7;

        // Получаем все товары
        const products = await ProductService.getActive();
        
        // Получаем продажи, остатки
        const salesAggregated = await SalesService.getAllAggregated(30);
        const stockAggregated = await StockService.getAllAggregated();

        const recommendations = [];

        for (const product of products) {
            const productId = product.id;
            const sales = salesAggregated[productId] || { orders: 0, revenue: 0 };
            const stock = stockAggregated[productId] || { total: 0, available: 0 };

            const sales30 = sales.orders || 0;
            const dailyDemand = sales30 / 30;
            const currentStock = stock.available || 0;

            // Рассчитываем рекомендуемый заказ
            const recommended = Math.max(0, Math.round(
                (dailyDemand * targetStockDays) - currentStock
            ));

            // Страховой запас
            const safetyStock = Math.round(dailyDemand * safetyStockDays);

            // Дней до обнуления
            const daysToStockout = dailyDemand > 0 
                ? Math.round(currentStock / dailyDemand) 
                : 999;

            // Срочность
            let urgency = 'normal';
            if (daysToStockout <= 3) urgency = 'critical';
            else if (daysToStockout <= 7) urgency = 'soon';

            // Рассчитываем ИО
            const io = dailyDemand > 0 
                ? parseFloat((currentStock / dailyDemand).toFixed(2))
                : 999;

            if (recommended > 0 || daysToStockout < 60) {
                recommendations.push({
                    productId,
                    article: product.article,
                    currentStock,
                    dailyDemand: parseFloat(dailyDemand.toFixed(1)),
                    daysToStockout,
                    safetyStock,
                    recommendedQuantity: recommended,
                    urgency,
                    io,
                    sales30
                });
            }
        }

        // Сортируем по срочности
        const order = { critical: 0, soon: 1, normal: 2 };
        recommendations.sort((a, b) => order[a.urgency] - order[b.urgency]);

        return recommendations;
    }

    // ============================================================
    // СОЗДАНИЕ ЗАКАЗА ИЗ РЕКОМЕНДАЦИЙ
    // ============================================================

    static async createOrderFromRecommendations(recommendations, supplier = '') {
        try {
            const order = await SupplyAggregate.createFromRecommendations(
                recommendations.map(r => ({
                    productId: r.productId,
                    recommendedQuantity: r.recommendedQuantity
                })),
                supplier
            );

            this._emitEvent('SupplyOrderCreated', {
                orderId: order.id,
                itemsCount: order.items.length,
                totalItems: order.getTotalItems()
            });

            return order;
        } catch (error) {
            console.error('[SupplyService] createOrder error:', error.message);
            throw error;
        }
    }

    // ============================================================
    // РАБОТА С ЗАКАЗАМИ
    // ============================================================

    static async getOrders() {
        return await SupplyAggregate.getAll();
    }

    static async getActiveOrders() {
        return await SupplyAggregate.getActive();
    }

    static async getOrderById(id) {
        return await SupplyAggregate.getById(id);
    }

    static async confirmOrder(orderId) {
        const order = await SupplyAggregate.confirm(orderId);
        this._emitEvent('SupplyOrderConfirmed', { orderId });
        return order;
    }

    static async markOrdered(orderId) {
        const order = await SupplyAggregate.markOrdered(orderId);
        this._emitEvent('SupplyOrderOrdered', { orderId });
        return order;
    }

    static async receiveItems(orderId, itemId, quantity) {
        const order = await SupplyAggregate.receiveItems(orderId, itemId, quantity);
        this._emitEvent('SupplyOrderReceived', { orderId, itemId, quantity });
        return order;
    }

    static async deleteOrder(orderId) {
        await SupplyAggregate.delete(orderId);
        this._emitEvent('SupplyOrderDeleted', { orderId });
    }

    // ============================================================
    // ОЧИСТКА
    // ============================================================

    static async clearAll() {
        await SupplyAggregate.clearAll();
    }

    // ============================================================
    // СОБЫТИЯ
    // ============================================================

    static _eventListeners = {};

    static on(eventName, callback) {
        if (!this._eventListeners[eventName]) {
            this._eventListeners[eventName] = [];
        }
        this._eventListeners[eventName].push(callback);
    }

    static _emitEvent(eventName, data) {
        const listeners = this._eventListeners[eventName] || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[SupplyService] Event listener error for ${eventName}:`, error);
            }
        });
    }
}

export default SupplyService;
