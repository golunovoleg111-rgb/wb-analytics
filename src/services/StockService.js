// ============================================================
// STOCK SERVICE — СЕРВИС ДЛЯ UI
// ============================================================

import StockAggregate from '../core/stock/StockAggregate.js';

class StockService {
    
    // ============================================================
    // ИМПОРТ
    // ============================================================

    static async importFromFile(data) {
        try {
            const result = await StockAggregate.createMany(data);
            this._emitEvent('StockImported', {
                recordsCount: result.results.length,
                errors: result.errors
            });
            return result;
        } catch (error) {
            console.error('[StockService] import error:', error.message);
            throw error;
        }
    }

    // ============================================================
    // ЧТЕНИЕ
    // ============================================================

    static async getByProduct(productId) {
        return await StockAggregate.getByProduct(productId);
    }

    static async getCurrent(productId) {
        return await StockAggregate.getCurrent(productId);
    }

    static async getAggregated(productId) {
        return await StockAggregate.getAggregated(productId);
    }

    static async getAllAggregated() {
        return await StockAggregate.getAllAggregated();
    }

    static async getWarehouses() {
        return await StockAggregate.getWarehouses();
    }

    // ============================================================
    // ТЕСТОВЫЕ ДАННЫЕ
    // ============================================================

    static async loadTestData(stockData) {
        try {
            const result = await StockAggregate.createMany(stockData);
            console.log(`[StockService] Загружено ${result.results.length} записей остатков`);
            return result;
        } catch (error) {
            console.error('[StockService] test data error:', error.message);
            throw error;
        }
    }

    // ============================================================
    // ОЧИСТКА
    // ============================================================

    static async clearAll() {
        await StockAggregate.clearAll();
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
                console.error(`[StockService] Event listener error for ${eventName}:`, error);
            }
        });
    }
}

export default StockService;
