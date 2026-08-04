// ============================================================
// SALES SERVICE — СЕРВИС ДЛЯ РАБОТЫ С ПРОДАЖАМИ (ДЛЯ UI)
// ============================================================

import SalesAggregate from '../core/sales/SalesAggregate.js';
import SalesRecord from '../core/sales/SalesRecord.js';

class SalesService {
    
    // ============================================================
    // ИМПОРТ
    // ============================================================

    static async importFromFile(data) {
        try {
            const result = await SalesAggregate.createMany(data);
            
            this._emitEvent('SalesImported', {
                recordsCount: result.results.length,
                errors: result.errors
            });
            
            return result;
        } catch (error) {
            console.error('[SalesService] import error:', error.message);
            throw error;
        }
    }

    // ============================================================
    // ЧТЕНИЕ
    // ============================================================

    static async getByProduct(productId) {
        return await SalesAggregate.getByProduct(productId);
    }

    static async getLastDays(productId, days = 30) {
        return await SalesAggregate.getLastDays(productId, days);
    }

    static async getAggregated(productId, days = 30) {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - days);
        
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = today.toISOString().split('T')[0];
        
        return await SalesAggregate.aggregateByProduct(productId, startStr, endStr);
    }

    // ============================================================
    // ПОЛУЧИТЬ ВСЕ ПРОДАЖИ (СЫРЫЕ ДАННЫЕ) — НОВЫЙ МЕТОД
    // ============================================================

    static async getAll() {
        return await SalesAggregate.getAll();
    }

    // ============================================================
    // ПОЛУЧИТЬ АГРЕГИРОВАННЫЕ ПРОДАЖИ ПО ВСЕМ ТОВАРАМ
    // ============================================================

    static async getAllAggregated(days = 30) {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - days);
        
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = today.toISOString().split('T')[0];
        
        const all = await SalesAggregate.getAll();
        const filtered = all.filter(r => r.date >= startStr && r.date <= endStr);
        
        const groups = {};
        filtered.forEach(r => {
            if (!groups[r.productId]) {
                groups[r.productId] = [];
            }
            groups[r.productId].push(r);
        });
        
        const result = {};
        Object.keys(groups).forEach(productId => {
            const agg = SalesRecord.aggregate(groups[productId]);
            result[productId] = {
                productId,
                orders: agg.totalOrders,
                delivered: agg.totalDelivered,
                returns: agg.totalReturns,
                revenue: agg.totalAmount,
                days
            };
        });
        
        return result;
    }

    static async getTotalRevenue(days = 30) {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - days);
        
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = today.toISOString().split('T')[0];
        
        return await SalesAggregate.getTotalRevenue(startStr, endStr);
    }

    // ============================================================
    // ТЕСТОВЫЕ ДАННЫЕ
    // ============================================================

    static async loadTestData(salesData) {
        try {
            const result = await SalesAggregate.createMany(salesData);
            console.log(`[SalesService] Загружено ${result.results.length} тестовых продаж`);
            return result;
        } catch (error) {
            console.error('[SalesService] test data error:', error.message);
            throw error;
        }
    }

    // ============================================================
    // ОЧИСТКА
    // ============================================================

    static async clearAll() {
        await SalesAggregate.clearAll();
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
                console.error(`[SalesService] Event listener error for ${eventName}:`, error);
            }
        });
    }
}

export default SalesService;
