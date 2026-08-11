// ============================================================
// STOCK AGGREGATE — ОСТАТКИ
// ============================================================

import StockRecord from './StockRecord.js';
import { Database } from '../../infrastructure/db.js';

const TOTAL_COLUMN_NAMES = new Set([
    'всего на складах',
    'всего находится на складах',
    'итого на складах',
    'остаток всего',
    'всего'
]);

function isRealWarehouse(name) {
    const value = String(name || '').trim().toLowerCase();
    return value && !TOTAL_COLUMN_NAMES.has(value);
}

function latestByWarehouse(records) {
    const latest = {};

    for (const record of records || []) {
        if (!isRealWarehouse(record.warehouseName)) continue;
        const key = record.warehouseName;
        const current = latest[key];

        if (!current ||
            String(record.date) > String(current.date) ||
            (String(record.date) === String(current.date) && String(record.createdAt) > String(current.createdAt))) {
            latest[key] = record;
        }
    }

    return Object.values(latest);
}

class StockAggregate {
    static async create(data) {
        const record = StockRecord.createFromImport(data);
        await Database.save(Database.STORES.STOCK, record);
        return record;
    }

    static async createMany(items) {
        const records = [];
        const errors = [];

        for (const item of items || []) {
            try {
                records.push(await this.create(item));
            } catch (error) {
                errors.push({ data: item, error: error.message });
            }
        }

        return { results: records, errors };
    }

    static async getByProduct(productId) {
        const all = await Database.getAll(Database.STORES.STOCK);
        return all.filter(r => r.productId === productId).map(r => new StockRecord(r));
    }

    static async getCurrent(productId) {
        return latestByWarehouse(await this.getByProduct(productId));
    }

    static async getAggregated(productId) {
        return StockRecord.aggregate(await this.getCurrent(productId));
    }

    static async getAllAggregated() {
        const all = (await Database.getAll(Database.STORES.STOCK)).map(r => new StockRecord(r));
        const groups = {};

        for (const record of all) {
            if (!groups[record.productId]) groups[record.productId] = [];
            groups[record.productId].push(record);
        }

        const result = {};
        for (const [productId, records] of Object.entries(groups)) {
            result[productId] = StockRecord.aggregate(latestByWarehouse(records));
        }

        return result;
    }

    static async getWarehouses() {
        const all = await Database.getAll(Database.STORES.STOCK);
        return [...new Set(all.map(r => r.warehouseName).filter(isRealWarehouse))].sort();
    }

    static async clearAll() {
        await Database.clear(Database.STORES.STOCK);
    }
}

export default StockAggregate;
