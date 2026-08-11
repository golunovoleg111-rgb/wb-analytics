// ============================================================
// SALES SERVICE — BELTANEE
// ============================================================

import SalesAggregate from '../core/sales/SalesAggregate.js';
import SalesRecord from '../core/sales/SalesRecord.js';

class SalesService {
    static async importFromFile(data) { return SalesAggregate.createMany(data); }
    static async getByProduct(productId) { return SalesAggregate.getByProduct(productId); }
    static async getLastDays(productId, days = 30) { return SalesAggregate.getLastDays(productId, days); }
    static async getAggregated(productId, days = 30) { return SalesAggregate.aggregateLastDaysByProduct(productId, days); }
    static async getAll() { return SalesAggregate.getAll(); }

    /**
     * Агрегация для UI: ключ группы изделия, а не случайный ключ варианта.
     * Одна дневная запись учитывается один раз.
     */
    static async getAllAggregated(days = 30) {
        const all = await this.getAll();
        const filtered = SalesRecord.filterLastDays(all, days);
        const groups = new Map();
        for (const record of filtered) {
            const key = record.productGroupKey || record.productId || record.articleKey || record.article;
            if (!key) continue;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(record);
        }
        const result = {};
        for (const [key, records] of groups) {
            const aggregate = SalesRecord.aggregate(records);
            result[String(key).trim().toLowerCase()] = {
                productGroupKey: key,
                productId: key,
                orders: aggregate.totalOrders,
                delivered: aggregate.totalDelivered,
                returns: aggregate.totalReturns,
                revenue: aggregate.totalAmount,
                records: aggregate.recordCount,
                days
            };
        }
        return result;
    }

    static async getTrustedSummary(startDate, endDate) { return SalesAggregate.getTrustedPeriodSummary(startDate, endDate); }
    static async getTotalRevenue(days = 30) {
        const all = await this.getAll();
        return SalesRecord.aggregate(SalesRecord.filterLastDays(all, days)).totalAmount;
    }
    static async clearAll() { return SalesAggregate.clearAll(); }
}

export default SalesService;
