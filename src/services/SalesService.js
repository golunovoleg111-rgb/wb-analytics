// ============================================================
// SALES SERVICE — BELTANEE v6.1
// ============================================================

import SalesAggregate from '../core/sales/SalesAggregate.js';
import SalesRecord from '../core/sales/SalesRecord.js';

class SalesService {
    static async importFromFile(data) {
        const result = await SalesAggregate.createMany(data);
        this._emitEvent('SalesImported', {
            recordsCount: result.results.length,
            errors: result.errors
        });
        return result;
    }

    static async getByProduct(productId) {
        return SalesAggregate.getByProduct(productId);
    }

    static async getLastDays(productId, days = 30) {
        return SalesRecord.filterLastDays(await this.getByProduct(productId), days);
    }

    static async getAggregated(productId, days = 30) {
        return SalesRecord.aggregate(await this.getLastDays(productId, days));
    }

    static async getAll() {
        return SalesAggregate.getAll();
    }

    static async getAllAggregated(days = 30) {
        const all = await this.getAll();
        const filtered = SalesRecord.filterLastDays(all, days);
        const groups = {};

        for (const record of filtered) {
            const key = record.productId || record.article;
            if (!key) continue;
            if (!groups[key]) groups[key] = [];
            groups[key].push(record);
        }

        const result = {};
        for (const [productId, records] of Object.entries(groups)) {
            const aggregate = SalesRecord.aggregate(records);
            result[productId] = {
                productId,
                orders: aggregate.totalOrders,
                delivered: aggregate.totalDelivered,
                returns: aggregate.totalReturns,
                revenue: aggregate.totalAmount,
                days
            };
        }

        return result;
    }

    static async getTotalRevenue(days = 30) {
        const all = await this.getAll();
        return SalesRecord.aggregate(SalesRecord.filterLastDays(all, days)).totalAmount;
    }

    static async clearAll() {
        await SalesAggregate.clearAll();
    }

    static _eventListeners = {};

    static on(eventName, callback) {
        if (!this._eventListeners[eventName]) this._eventListeners[eventName] = [];
        this._eventListeners[eventName].push(callback);
    }

    static _emitEvent(eventName, data) {
        for (const callback of this._eventListeners[eventName] || []) {
            try { callback(data); } catch (error) { console.error(`[SalesService] ${eventName}`, error); }
        }
    }
}

export default SalesService;
