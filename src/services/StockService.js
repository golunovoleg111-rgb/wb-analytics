// ============================================================
// STOCK SERVICE — BELTANEE v6.1
// ============================================================

import StockAggregate from '../core/stock/StockAggregate.js';

class StockService {
    static async importFromFile(data) {
        const result = await StockAggregate.createMany(data);
        this._emitEvent('StockImported', { recordsCount: result.results.length, errors: result.errors });
        return result;
    }

    static async getByProduct(productId) {
        return StockAggregate.getByProduct(productId);
    }

    static async getCurrent(productId) {
        return StockAggregate.getCurrent(productId);
    }

    static async getAggregated(productId) {
        return StockAggregate.getAggregated(productId);
    }

    static async getAllAggregated() {
        return StockAggregate.getAllAggregated();
    }

    static async getWarehouses() {
        return StockAggregate.getWarehouses();
    }

    static async clearAll() {
        await StockAggregate.clearAll();
    }

    static _eventListeners = {};

    static on(eventName, callback) {
        if (!this._eventListeners[eventName]) this._eventListeners[eventName] = [];
        this._eventListeners[eventName].push(callback);
    }

    static _emitEvent(eventName, data) {
        for (const callback of this._eventListeners[eventName] || []) {
            try { callback(data); } catch (error) { console.error(`[StockService] ${eventName}`, error); }
        }
    }
}

export default StockService;
