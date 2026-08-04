// ============================================================
// STOCK AGGREGATE — ЛОГИКА РАБОТЫ С ОСТАТКАМИ
// ============================================================

import StockRecord from './StockRecord.js';
import { Database } from '../../infrastructure/db.js';

class StockAggregate {
    
    // ============================================================
    // СОЗДАНИЕ
    // ============================================================

    static async create(data) {
        const record = StockRecord.createFromImport(data);
        await Database.save(Database.STORES.STOCK, record);
        return record;
    }

    static async createMany(items) {
        const results = [];
        const errors = [];

        for (const item of items) {
            try {
                const record = await this.create(item);
                results.push(record);
            } catch (error) {
                errors.push({ data: item, error: error.message });
            }
        }

        return { results, errors };
    }

    // ============================================================
    // ЧТЕНИЕ
    // ============================================================

    static async getByProduct(productId) {
        const all = await Database.getAll(Database.STORES.STOCK);
        return all
            .filter(r => r.productId === productId)
            .map(r => new StockRecord(r));
    }

    static async getCurrent(productId) {
        const all = await this.getByProduct(productId);
        // Берём последние записи по каждому складу
        const latest = {};
        all.forEach(r => {
            const key = r.warehouseName || 'unknown';
            if (!latest[key] || r.date > latest[key].date) {
                latest[key] = r;
            }
        });
        return Object.values(latest);
    }

    static async getAggregated(productId) {
        const current = await this.getCurrent(productId);
        return StockRecord.aggregate(current);
    }

    static async getAllAggregated() {
        const all = await Database.getAll(Database.STORES.STOCK);
        const records = all.map(r => new StockRecord(r));
        
        // Группируем по productId
        const groups = {};
        records.forEach(r => {
            if (!groups[r.productId]) {
                groups[r.productId] = [];
            }
            groups[r.productId].push(r);
        });

        // Агрегируем по каждому товару
        const result = {};
        Object.keys(groups).forEach(productId => {
            // Берём последние записи по каждому складу
            const latest = {};
            groups[productId].forEach(r => {
                const key = r.warehouseName || 'unknown';
                if (!latest[key] || r.date > latest[key].date) {
                    latest[key] = r;
                }
            });
            const current = Object.values(latest);
            result[productId] = StockRecord.aggregate(current);
        });

        return result;
    }

    // Получить склады, где есть остатки
    static async getWarehouses() {
        const all = await Database.getAll(Database.STORES.STOCK);
        const warehouses = new Set();
        all.forEach(r => {
            if (r.warehouseName) warehouses.add(r.warehouseName);
        });
        return Array.from(warehouses).sort();
    }

    // ============================================================
    // ОЧИСТКА
    // ============================================================

    static async clearAll() {
        await Database.clear(Database.STORES.STOCK);
    }
}

export default StockAggregate;
